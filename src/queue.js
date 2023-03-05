import RelayChecker from './checker.js'
import { Opts as RelayCheckerOpts } from './types.js'
import Queue from 'p-queue'

const DEFAULT_MAX_QUEUES = 10,
      DEFAULT_CONCURRENCY = 5,
      DEFAULT_FAST_TIMEOUT = 3000

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
  this.cb = new Object()

  //Accumulator, TODO: add option to enable/disable
  this.results = new Object
  
  //Experimental: Use multiple queues with concurrency to help avoid the clogging of offline relays during retry pass.
  this.maxQueues = opts?.maxQueues || DEFAULT_MAX_QUEUES

  //How many jobs run concurrently per queue
  this.concurrency = opts?.concurrency || DEFAULT_CONCURRENCY

  //If maxQueues is more than relays, reset to relays.length. TODO: Convert to one-liner (&)
  if(this.maxQueues > this.relays.length)
    this.maxQueues = this.relays.length

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
}

QueuedChecker.prototype.run = async function(){
  this.queuesInit()
  await Promise.all(this.promises.map( deferred => deferred.promise ))
  this.on_complete()
}

QueuedChecker.prototype.queuesInit = async function(fast){
  for(let index=0; index<this.queue.length; index++) {
    this.queue[index] = new Queue({concurrency: this.concurrency})
    this.addJobsToQueue(index)
    this.queue[index].on('empty', () => this.addJobsToQueue(index))
    this.queue[index].on('idle', () => this.tryComplete(index) )
    this.promises[index] = new Deferred()
  }
}

QueuedChecker.prototype.addJobsToQueue = async function(index){
  let added = 0
  while(added < 5){
    if(!this.relays.length && !this.retry.length)
      break
    const type = this.relays.length ? 'relays' : 'retry'
    await this.queue[index].add(this.job(type))
    added++
  }
}

QueuedChecker.prototype.tryComplete = function(index){
  if(!this.relays.length && !this.retry.length)
    this.promises[index].resolve()
}

QueuedChecker.prototype.job = function(type){
  return async () => await this.check(this[type].shift(), type)
}

QueuedChecker.prototype.check = async function(relay, type){
  return new Promise( resolve => {
    let $checker = new RelayChecker(relay, this.RelayCheckerOpts)
    $checker
      .on('complete', self => this.checkComplete(self).then(resolve))
      .run()
    if(type === 'relays')
      this.timeouts[$checker.url] = this.delay($checker).then(resolve)
  })
}

QueuedChecker.prototype.delay = async function($checker) {
  await new Promise( resolve => setTimeout(resolve, this.fastTimeout) )
  this.retry.push($checker.result.url)
  console.log($checker.result.url, 'timeout!')
  $checker.close()
  $checker = null
}

QueuedChecker.prototype.checkComplete = async function($checker) {
  if(this.timeouts[$checker.url] !== null)
    this.timeouts[$checker.url] = null
  this.on_result($checker.result)
}

QueuedChecker.prototype.abort = function(){
  this.controller
}

QueuedChecker.prototype.on_complete = function(){
  this.duration = Date.now()-this.start 
  console.log(`took ${Math.round(this.duration/1000)} seconds`)
  this.cbcall("complete", this.results)
}

QueuedChecker.prototype.on_result = function(result){
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