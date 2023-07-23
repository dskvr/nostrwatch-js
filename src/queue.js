import RelayChecker from './checker.js'
import { Opts as RelayCheckerOpts, Result as RelayCheckerResult } from './types.js'
import Queue from 'p-queue'

const DEFAULT_MAX_QUEUES = 20,
      DEFAULT_CONCURRENCY = 1,
      DEFAULT_FAST_TIMEOUT = 3000,
      DEFAULT_THROTTLE = 100,
      DEFAULT_REFILL_NUM = 1

export default function QueuedChecker(relays, opts){
  this.setup(relays, opts)
  this.run()
}

QueuedChecker.prototype.setup = function(relays, opts){
  if(!(relays instanceof Array))
    return console.error('relays argument must be an array')

  //TODO {: Clean this up, presently using "relays" and "retry" as keys in logic, should be cleaner.

  //Initial array for relays, uniquify
  this.relays = Array.from(new Set(relays))

  //If relays do not complete within fastTimeout, they are added to try. 
  this.retry = new Array()

  //}

  //Array for completed, used for progress. 
  this.completed = new Array()

  //holds user defined callbacks.
  this.cb = {}

  //Accumulator, TODO: add option to enable/disable
  this.results = new Object
  
  //Experimental: Use multiple queues with concurrency to help avoid the clogging of offline relays during retry pass.
  this.maxQueues = opts?.maxQueues || DEFAULT_MAX_QUEUES

  //How many jobs run concurrently per queue
  this.concurrency = opts?.concurrency ? opts.concurrency : DEFAULT_CONCURRENCY

  //If maxQueues is more than relays, reset to relays.length. TODO: Convert to one-liner (&)
  if(this.maxQueues > this.relays.length)
    this.maxQueues = this.relays.length

  //Throttle millis before starting each job.
  this.throttleMillis = opts?.throttleMillis || DEFAULT_THROTTLE

  this.numRelaysPerRefill = opts?.numRelaysPerRefill || DEFAULT_REFILL_NUM

  //Array for Queue instances 
  this.queue = new Array(this.maxQueues)

  //Array for deferred promises 
  this.promises = new Array(this.maxQueues)

  //Array for timeouts (key is relay url)
  this.timeouts = {}

  //Threshold for first pass (speed bias batching)
  this.fastTimeout = opts?.fastTimeout || DEFAULT_FAST_TIMEOUT

  //If set to true, will ignore maxQueues and instead add one queue per thread
  // this.multiThreaded = opts?.multiThreaded || false 

  //Passthrough options for RelayChecker
  this.RelayCheckerOpts = opts?.RelayChecker || structuredClone(RelayCheckerOpts)

  //Progress percentage (int)
  this.progress = 0

  //Abort controller 
  this.controller = new AbortController();

  //Start time 
  this.start = Date.now()

  //Elapsed time (updated each relay's on_result)
  this.elapsed = 0
  
  this.lastJobQueued = Date.now()
}

QueuedChecker.prototype.run = async function(){
  this.queuesInit()
  // console.log(this.promises.map( deferred => deferred.promise ))
  await Promise.all(this.promises.map( deferred => deferred.promise ))
  this.on_complete()
}

QueuedChecker.prototype.queuesInit = async function(fast){
  for(let index=0; index<this.queue.length; index++) {
    this.queue[index] = new Queue({
      concurrency: this.concurrency,
      autoStart: false
    })
    this.addJobsToQueue(index)
    this.queue[index].on('empty', () => this.addJobsToQueue(index))
    this.queue[index].on('idle', () => this.tryComplete(index) )
    this.promises[index] = new Deferred()
  }

  for(let index=0; index<this.queue.length; index++) {
    await this.delay(1000)
    this.queue[index].start()
  }
}

QueuedChecker.prototype.tryComplete = function(index){
  if(!this.relays.length)
    this.promises[index].resolve()
}

QueuedChecker.prototype.addJobsToQueue = async function(index){
  let added = 0
  while(added < this.numRelaysPerRefill){
    if(!this.relays.length && !this.retry.length)
      break
    const type = this.relays.length ? 'relays' : 'retry'
    this.addJob(index, type)
    added++
  }
}

QueuedChecker.prototype.addJob = async function(index, type){
  await this.throttle()
  this.queue[index].add(this.job(type))
}

QueuedChecker.prototype.job = function(type){
  return () => this.check(this[type].shift(), type)
}

QueuedChecker.prototype.throttle = async function(){
  const lJ = this?.lastJobQueued || Date.now(),
        delay = this.throttleMillis
  this.lastJobQueued = lJ+this.throttleMillis
  return new Promise( resolve => setTimeout( () => resolve(delay), delay ))
}

QueuedChecker.prototype.check = async function(relay, type){
  // console.log('checking at:', Date.now())
  return new Promise( resolve => {
    if(typeof relay === 'undefined')
      resolve()
    let $checker = new RelayChecker(relay, this.RelayCheckerOpts)
    $checker
      .on('complete', self => {
        // console.log('check()', self)
        this.on_result(self.result).then(resolve)
      })
      .on('error', () => {
        this.on_result($checker.result).then(resolve)
      })
      .run()
    // if(type === 'relays')
    //   this.timeouts[$checker.url] = this.retryRelay($checker).then(resolve)
  })
}

QueuedChecker.prototype.delay = async function(delay) {
  await new Promise( resolve => setTimeout(resolve, delay) )
}

QueuedChecker.prototype.retryRelay = async function($checker){
  await this.delay(this.fastTimeout)
  if(typeof $checker.result.url !== 'undefined')
    this.retry.push($checker.result.url)
  $checker.close()
  $checker = null
}

QueuedChecker.prototype.abort = function(){
  this.controller
}

QueuedChecker.prototype.on_complete = function(){
  this.duration = Date.now()-this.start 
  console.log(`took ${Math.round(this.duration/1000)} seconds`)
  this.cbcall("complete", this.results)
}

QueuedChecker.prototype.on_result = async function(result){
  // console.log('on result!', result?.url, result?.check, result?.latency)

  // if(this.timeouts[result.url] !== null)
  //   this.timeouts[result.url] = null

  // console.log(result.url, 'checkComplete()', 'connect:', result.check?.connect)
  const relay = result.url
  this.completed.push(relay)
  this.results[relay] = result
  this.updateProgress()
  this.cbcall("result", result, this)
}

QueuedChecker.prototype.cbcall = function(method) {
  [].shift.call(arguments,1)

  if(typeof this.cb[method] === 'function')
    this.cb[method](...arguments)
}

QueuedChecker.prototype.on = function(method, fn) {
  console.log(typeof this.cb, typeof method, typeof fn)
  this.cb[method] = fn
  return this
}

QueuedChecker.prototype.updateProgress = function(){
  const pending = [...this.relays, ...this.retry].length
  const total = pending+this.completed.length
  this.progress = Math.floor(this.completed.length/total*100)
  this.elapsed = Math.round((Date.now()-this.start)/1000)
}

class Deferred {
  constructor() {
    this.promise = new Promise((resolve, reject)=> {
      this.reject = reject
      this.resolve = resolve
    })
  }
}