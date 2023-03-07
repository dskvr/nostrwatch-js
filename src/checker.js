/* eslint-disable */
import { Relay } from 'nostr'
import crypto from 'crypto'
import { Result, Opts, Timeout } from './types.js'
import config from '../config/index.js'
import fetch from 'cross-fetch'
import {generatePrivateKey, getPublicKey, getEventHash, signEvent} from 'nostr-tools'



export default function RelayChecker(relay, opts={})
{
  this.setup(opts)
  this.relay =  new Relay(relay, {reconnect: false})
  this.result.state = 'pending'
  this.result.url = this.relay.url

  if(this.opts.run)
    this.run()

  return this
}

RelayChecker.prototype.setup = function(opts){
  this.cb = new Object()
  this.opts = Object.assign(structuredClone(Opts), opts)

  this.result = structuredClone(Result)
  this.timeout = structuredClone(Timeout)
  this.result.log = new Array()
  this.read_latencies = new Array()
  this.checks = new Array()

  this.testEvent = this.opts.testEvent || config.testEvent
  
  if(this.opts?.data !== null) 
    this.result = this.opts?.data?.result ? Object.assign(this.result, this.opts.data.result) : this.result

  if(this.opts.debug)
    console.log('options', this.opts)
}

// PUBLIC
RelayChecker.prototype.run = async function() {
  if(this.opts.debug) 
    console.log(this.relay.url, "running")
  
  if(!this.relay.onfn.open)
    this.relay
      .on('open',   (e) => this.on_open(e))

  this.relay
    .on('eose',     (e) => this.on_eose(e))
    .on('error',    (e) => this.on_error(e))
    .on('ok',       (e) => this.on_ok(e))
    .on('close',    (e) => this.on_close(e))
    .on('event',    (subid, event) => this.on_event(subid, event))
    .on('notice',   (notice) => this.on_notice(notice))

  if(!this.opts.run) //only call if not autorun
    this.cbcall('run', this.result)
  
  if(this.opts.debug)
    console.log(this.relay.url, "connect_timeout_init", this.opts.connectTimeout)

  this.timeout.connect = setTimeout(() => {
    if(this.latency?.connect)
      return console.warn(this.relay.url, `timeout still triggered for some reason when connect=${connect}... returning.`)
    if(this.opts.debug)
      console.log(this.relay.url, "connect_timeout")
    this.log('timeout', `Could not connect to relay within ${this.opts.connectTimeout}ms`)
    this.hard_fail()
  }, this.opts.connectTimeout)
  
  this.connect_timeout(this.relay.url)
  this.result.latency.begin.connect = Date.now()

  return this
}

RelayChecker.prototype.close = async function() {
  if( this.wsIsOpen() )
    this.relay.close()
} 
RelayChecker.prototype.setOpts = function() {
  if(arguments[0] == 'checkNip'){
    if(typeof arguments[1] === 'string') {
      argments[0] = arguments[1]
    }
    if(Array.isArray(arguments[1])) {
      arguments[1].forEach((nip) => {
        this.opts.checkNip[nip] = arguments[2]
      })
    }
  }
  else {
    this.opts[arguments[0]] = arguments[1]
  }
}

RelayChecker.prototype.getInfo = async function(){
  this.update_state(`retrieving nip11`)
  this.result.latency.begin.nip11 = Date.now()
  const url = new URL(this.relay.url),
        headers = {
          "Accept": "application/nostr+json",
        }
  let res = await new Promise( async (resolve) => {
    this.timeout.info = setTimeout( () => { 
      this.log(`timeout`, `NIP-11 info document was not returned within 10000 milliseconds`) //need to add timeout opt for info.
      resolve( {} ) 
    }, 10*1000 )
    const _res = await fetch(`https://${url.hostname}/`, { method: 'GET', headers: headers})
      .then(async response => { 
        try {
          let res = await response.json()
          this.result.latency.nip11 = Date.now() - this.result.latency.begin.nip11
          this.log(`success`, `NIP-11 info document was fetched and parsed in ${this.result.latency.nip11}ms`) //need to add timeout opt for info.
          return res 
        } catch (err) {
          if (this.opts.debug)
            console.error(`${this.relay.url}`, err)
          this.log('error', 'Could not parse NIP-11 information document')
        } 
      })
      .catch(err => {
        console.error(`${this.relay.url}`, err) //could pass this error to log
        this.log('error', 'Host returned an error when attempting to fetch NIP-11 info document')
        return false
      });
    resolve( _res )
    clearTimeout(this.timeout.info) 
  })

  if(this.opts.debug)
    console.log(`https://${url.hostname}/`, 'check_nip_11', res)

  return res
}

RelayChecker.prototype.reset = function(hard){
  this.result = structuredClone(Result)
}

RelayChecker.prototype.key = function(id){
  return `${id}_${hashString(this.relay.url)}`
}

RelayChecker.prototype.get_info = async function(){
  this.result.info = await this.getInfo()

  this.validate_pubkey()

  return true
}

RelayChecker.prototype.validate_pubkey = function(){
  if(this.result?.info?.pubkey) {
    this.result.pubkeyValid = this.is_pubkey_valid()
    if(this.result.pubkeyValid) 
      this.result.identities = Object.assign(this.result.identities, { serverAdmin: this.result.info.pubkey })      
  }
  else {
    this.result.pubkeyError = "pubkey is not set"
  }
}

RelayChecker.prototype.is_pubkey_valid = function(){
  if(this.result.info.pubkey.startsWith('npub')) {
    this.result.pubkeyError = "pubkey is in npub format, should be hex"
    return false
  }
  if(!this.result.info.pubkey.match(/[0-9A-Fa-f]{6}/g)) {
    this.result.pubkeyError = "pubkey is not hex"
    return false
  }
  const pubkeyHex = Uint8Array.from(Buffer.from(this.result.info.pubkey, 'hex'));
  if(pubkeyHex.length !== 32){
    this.result.pubkeyError = 'pubkey is expected to be 32'
    return false
  }
  return true
}

/*
  Event Emitters
*/
RelayChecker.prototype.check_read = function(benchmark) {
  

  const which = benchmark ? `latency-${this.read_latencies.length}` : 'read'
  const subid = this.key(which)

  if(this.opts.debug)
    console.log(this.relay.url, "check_read", `via: ${which}`, subid)

  this.result.latency.begin.read = Date.now()
  this.relay.subscribe(subid, {limit: 1, kinds:[1]})

  if('read' === which)
    this.update_state(`subscribed, waiting for event(s)`)

  this.timeout[which] = setTimeout(() => {
    if(this.opts.debug) 
      console.log(this.relay.url, "check_read_timeout", `via: ${which}`, subid)

    const logLabel = which.includes('latency') ? 'latency' : 'read'
    this.log(`timeout`, `A ${logLabel} check timed out since it did not complete within ${this.opts?.readTimeout}ms`)

    if(which.includes('latency'))
      this.result.check.latency = false 
    else 
      this.result.check.read = false
    
    if(this.checks.length)
      this.execute_next_check()
    else
      this.try_complete()
  }, this.opts.readTimeout)
}

RelayChecker.prototype.check_write = function() {
  this.update_state(`checking write`)
  
  const subid = this.key('write')

  if(this.opts.debug)
    console.log(this.relay.url, "check_write", subid)
  
  if(!this.opts?.testEvent && this.payment_required())
    this.opts.testEvent = this.generateTestEvent()

  if(this.opts.debug)
    console.log(this.relay.url, "test_event", this.testEvent.id, this.testEvent.content)

  this.result.latency.begin.write = Date.now()

  this.relay.send(["EVENT", this.testEvent])

  if(this.payment_required())
    this.relay.subscribe(subid, {limit: 1, kinds:[1], ids:[this.testEvent.id]})

  this.update_state(`published event and subscribed, waiting for event(s)`)

  this.timeout.write = setTimeout(() => {
    if(this.opts.debug) 
      console.log(this.relay.url, "check_write_timeout", subid)
    if(this.payment_required())
      this.log('timeout', `Subscription to test event was not recieved within ${this.opts.writeTimeout}ms of publishing the event (${this.testEvent.id})`)
    else 
      this.log('timeout', `Relay did not send 'ok' within ${this.opts.writeTimeout}ms of publishing an event`)
    this.result.check.write = false
    if(this.checks.length)
      this.execute_next_check()
    else
      this.try_complete()
  }, this.opts.writeTimeout)
}

RelayChecker.prototype.check_latency = function(index) {
  if(this.result.check.read === false)
    return this.skip_latency_check(index)

  const key = `latency-${this.read_latencies.length}`
  const subid = this.key(key)
  
  this.result.count[key] = 0

  this.result.latency.begin[this.read_latencies.length] = Date.now()

  this.check_read(true)
}

RelayChecker.prototype.skip_latency_check = function(index){
  if(this.opts.debug)
      console.log(this.relay.url, "skip_latency_check", "Skipping since read check failed")      
  if(index === 0)
    this.log('skip', `Latency checks are being skipped since the read check failed`)
  this.result.check.latency = false
  if(this.checks.length)
    this.execute_next_check()
  else
    this.try_complete()
  this.on_change()
}

RelayChecker.prototype.execute_next_check = async function(){
  if(this.opts.debug)
    console.log(this.relay.url, 'execute_next_check', this.checks.length)
  
  if(!this.checks.length)
    return this.try_complete()
  
  if(this.opts?.delayBetweenChecks > 0) 
    await new Promise( resolve => setTimeout(resolve, this.opts.delayBetweenChecks))

  this.on_change()

  const fn = this.checks.shift()
  
  if(!(fn instanceof Function))
    return this.try_complete()

  fn()
}

/* 
  Event Handlers
*/
RelayChecker.prototype.handle_event = function(subid, event) {
  const type = subid.split('_')[0]
  clearTimeout(this.timeout[type])
  if( this.do_handle_event(type) ) {
    if(this.opts.debug)
      console.log(this.relay.url, "handle_event", subid)

    if( this.wsIsOpen() )
      this.relay.unsubscribe(subid)

    if(!type.includes('latency')){
      this.result.check[type] = true
      this.result.latency[type] = Date.now() - this.result.latency.begin[type]
      if(type === 'write')
        this.log('success', `handled event from ${type} check in ${this.result.latency[type]}ms (test event.id: ${this.testEvent.id})`)
      else
        this.log('success', `handled event from ${type} check in ${this.result.latency[type]}ms`)
    }
    else {
      this.handle_read_latencies()
    }

    this.on_change()
    this.execute_next_check()
  }
  this.result.count[type]++
}

RelayChecker.prototype.handle_read_latencies = function(){
  const latency = Date.now() - this.result.latency.begin[this.read_latencies.length]
  this.read_latencies.push(latency)
  this.update_state(`checked latency #${this.read_latencies.length}/${this.opts.latencyPings}`)

  this.log(`success`, `latency check #${this.read_latencies.length} was ${latency}ms `)

  if(this.read_latencies.length < this.opts.latencyPings){

    if( this.wsIsOpen() )
      this.relay.unsubscribe(this.key(`latency-${this.read_latencies.length}`))

    if(this.opts.debug)
      console.log(this.relay.url, 'check_latency', `${this.read_latencies.length}/${this.opts.latencyPings}`, `took ${latency}ms`)

  }
  else {

    this.result.latency.data = this.read_latencies

    if( this.wsIsOpen() )
      this.relay.unsubscribe(this.key(`latency-${this.read_latencies.length}`))

    this.result.check.latency = true
    this.try_complete()

  }

  this.on_change()
}

RelayChecker.prototype.do_handle_event = function(type){
  if(type.includes('latency') && this.result.count[type] < 1 && this.read_latencies.length <= this.opts.latencyPings) 
    return true
    
  if(this.result.count[type] < 1)
    return true 
}

/*
  Event Callbacks
*/

RelayChecker.prototype.on_change = function(){
  this.cbcall("change", this.result)
}

RelayChecker.prototype.on_open = async function(e) {
    if(this.opts.debug)
    console.log(this.relay.url, 'cleared timeout', 'connect')

  this.result.check.connect = true
  this.result.latency.connect = Date.now() - this.result.latency.begin.connect

  this.log('success', `connected to relay in ${this.result.latency.connect}ms`)

  if(this.opts.getInfo)
    await this.get_info()

  if(this.opts.checkRead)
    this.checks.push(() => this.check_read())

  if(this.opts.checkWrite)
    this.checks.push(() => this.check_write())

  if(this.opts.checkLatency) {
    for(let c=0;c<this.opts.latencyPings;c++){
      this.checks.push(() => this.check_latency(c))
    }
  }

  if(this.opts.debug) 
    console.log(this.relay.url, "on_open")

  clearTimeout(this.timeout.connect)

  this.execute_next_check()
  this.cbcall("open", e, this.result)

}


RelayChecker.prototype.on_close = function(e) {
  if(this.opts.debug) 
    console.log(this.relay.url, "on_close")

  this.cbcall("close", e, this.result)
}

RelayChecker.prototype.on_eose = function(eose) {
  if(this.opts.debug)
    console.log(this.relay.url, "on_eose")

  this.cbcall("eose", eose, this.result)
}

RelayChecker.prototype.update_state = function(state){
  this.result.state = state
  this.on_change()
}

RelayChecker.prototype.on_ok = function(ok) {
  if(this.opts.debug)
    console.log(this.relay.url, "on_ok")

  if(this.payment_required())
    return
  
  clearTimeout(this.timeout.write)
  this.result.latency.write = Date.now() - this.result.latency.begin.write
  this.log('success', `recieved 'ok' from relay on write check in ${this.result.latency.write}ms`)
  this.result.check.write = true 

  this.execute_next_check()

  this.cbcall("ok", ok)
}

RelayChecker.prototype.on_error = function(err) {
  if(this.opts.debug)
    console.log(this.relay.url, "on_error", err)

  if(this.result.count.error == 0 && this.state === 'pending') {
    clearTimeout(this.timeout.connect)
    this.hard_fail()
    this.cbcall("error", err)
  }
  this.result.count.error++
}

RelayChecker.prototype.on_event = function(subid, event) {
  // if(this.opts.debug)
  //   console.log(this.relay.url, "on_event", subid, event.id)

  this.handle_event(subid, event)

  this.cbcall("event", subid, event, this.result)
}

RelayChecker.prototype.on_notice = function(notice) {
  this.log('notice', `Recieved notice from relay: ${notice}`)
  this.cbcall("notice", notice, this.result)
  this.on_change()
}

RelayChecker.prototype.try_complete = function() {
  let connect = this.result.check.connect !== null, //check null
      read = this.result.check.read !== null || this.opts.checkRead !== true,
      write = this.result.check.write !== null || this.opts.checkWrite !== true,
      latency = this.result.check.latency !== null || this.opts.checkLatency !== true

  const didComplete = connect && read && write && latency

  if(this.opts.debug)
    console.log(this.relay.url, "try_complete", `state: ${this.result.state}`, connect, read, write, latency)

  if(didComplete) {
    if(this.result.state === 'complete')
      return

    // if(!this.result.check.connect && (this.result.check.read || this.result.check.write))
    //   this.result.check.connect = true

    if(this.opts.debug)
      console.log(this.relay.url, "did_complete", connect, read, write, latency, this.result.check)

    this.result.state = 'complete'

    if(!this.opts.keepAlive) 
      this.close()

    if(this.opts.debug) 
      console.log(this.relay.url, 'checks', this.result.check)
    
    this.cbcall('complete', this)
  }
}

RelayChecker.prototype.connect_timeout = function(relay_url){
}

RelayChecker.prototype.hard_fail = function(){
  if(this.state === 'complete')
    return 
  
  if( this.wsIsOpen() )
    this.close()
    
  if(this.opts.debug)
    console.log(this.relay.url, "hard_fail")
  
  this.checks = new Array()

  this.result.check.connect = false
  this.result.check.read = false
  this.result.check.write = false
  this.result.check.latency = false
  this.try_complete()
}

RelayChecker.prototype.sha1 = function(message) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(message)).digest('hex')
  return hash
}

RelayChecker.prototype.on = function(method, fn) {
  this.cb[method] = fn
  return this
}

RelayChecker.prototype.cbcall = function(method) {
  [].shift.call(arguments,1)

  // console.log(this.relay.url, 'cbcall', method, ...arguments)

  if(typeof this.cb[method] === 'function')
    this.cb[method](...arguments)
}

RelayChecker.prototype.wsIsOpen = function(){
  return this.relay.ws?.readyState === 1
}

RelayChecker.prototype.log = function(type, message){
  this.result.log.push([type, message])
}

RelayChecker.prototype.payment_required = function(){
  return this.result?.info?.limitation?.payment_required
}

RelayChecker.prototype.generateTestEvent = function(){
  //if opts.testEvent is unset...
  if(this.opts.testEvent)
    return 
  //only use for paid relays!
  if(!this.result?.info?.limitation?.payment_required)
    return 
  //generate keypair 
  let sk = generatePrivateKey() // `sk` is a hex string
  let pk = getPublicKey(sk) // `pk` is a hex string

  //randomize event content 
  const event = {
    created_at: Math.round(Date.now()/1000),
    kind: 1,
    content: crypto.randomBytes(getRandomInt(10,120)).toString('hex'),
    tags: [],
    pubkey: pk
  }

  event.id = getEventHash(event)
  event.sig = signEvent(event, sk)

  return event
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
      let chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0; // Convert to 32bit integer
  }
  return hash;
}