/* eslint-disable */
import { Relay } from 'nostr'
import crypto from 'crypto'
import { Result, Opts, Timeout } from './types.js'
import config from '../config/index.js'
import fetch from 'cross-fetch'

export default function Inspector(relay, opts={})
{
  this.setup(opts)
  this.relay =  new Relay(relay, {reconnect: false})
  this.result.state = 'pending'
  this.result.url = this.relay.url

  if(this.opts.run)
    this.run()

  return this
}

// PUBLIC
Inspector.prototype.run = async function() {
  if(this.opts.debug) 
    console.log(this.relay.url, "running")

  this.connect_timeout(this.relay.url)

  this.result.latency.begin['connect'] = Date.now()

  if(!this.relay.onfn.open)
    this.relay
      .on('open',     (e) => this.on_open(e))

  this.relay
    .on('eose',     (e) => this.on_eose(e))
    .on('error',    (e) => this.on_error(e))
    .on('ok',       (e) => this.on_ok(e))
    .on('close',    (e) => this.on_close(e))
    .on('event',    (subid, event) => this.on_event(subid, event))
    .on('notice',   (notice) => this.on_notice(notice))

  if(!this.opts.run) //only call if not autorun
    this.cbcall('run', this.result)

  return this
}

Inspector.prototype.close = async function() {
  if( wsIsOpen(this.relay.ws) )
    this.relay.close()
} 

Inspector.prototype.setup = function(opts){
  this.cb = new Object()
  this.opts = Object.assign(structuredClone(Opts), opts)

  this.result = structuredClone(Result)
  this.timeout = structuredClone(Timeout)
  this.instanced = false
  this.promises = new Object()
  this.log = new Array()
  this.latencies = new Array()
  this.checks = new Array()
  
  if(this.opts?.data !== null) 
    this.result = this.opts?.data?.result ? Object.assign(this.result, this.opts.data.result) : this.result

  if(this.opts.debug)
    console.log('options', this.opts)
}

Inspector.prototype.setOpts = function() {
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

Inspector.prototype.getInfo = async function(){
  const url = new URL(this.relay.url),
        headers = {
          "Accept": "application/nostr+json",
        }
    
  let res = await new Promise( async (resolve) => {
    this.timeout.info = setTimeout( () => { resolve( {} ) }, 10*1000 )
    const _res = await fetch(`https://${url.hostname}/`, { method: 'GET', headers: headers})
      .then(async response => { 
        try {
          return await response.json()
        } catch (err) {
          if (this.opts.debug)
            console.error(`${this.relay.url}`, err)
        } 
      })
      .catch(err => {
        this.log.push(['error', 'was unable to retrieve NIP-11'])
        console.error(`${this.relay.url}`, err) 
        return false
      });
    resolve( _res )
    clearTimeout(this.timeout.info)
  })

  if(this.opts.debug)
    console.log(`https://${url.hostname}/`, 'check_nip_11', res)

  return res
}

Inspector.prototype.nip = function(nip_num){
  return this.result.nips[nip_num]
}

Inspector.prototype.reset = function(hard){
  this.result = structuredClone(Result)
}

Inspector.prototype.key = function(id){
  return `${id}_${hashString(this.relay.url)}`
}

Inspector.prototype.get_info = async function(){
  this.result.info = await this.getInfo()

  this.validate_pubkey()

  if(this.opts.debug)
    console.log('get_info', this.result.info)

  return true
}

Inspector.prototype.validate_pubkey = function(){
  if(this.result?.info?.pubkey) {
    this.result.pubkeyValid = this.is_pubkey_valid()
    if(this.result.pubkeyValid) 
      this.result.identities = Object.assign(this.result.identities, { serverAdmin: this.result.info.pubkey })      
  }
  else {
    this.result.pubkeyError = "pubkey is not set"
  }
}

Inspector.prototype.is_pubkey_valid = function(){
  if(this.result.info.pubkey.startsWith('npub')) {
    this.result.pubkeyError = "pubkey is in npub format, should be hex"
    return false
  }
  if(!this.result.info.pubkey.match(/[0-9A-Fa-f]{6}/g)) {
    this.result.pubkeyError = "pubkey is not hex"
    return false
  }
  const pubkey = Uint8Array.from(Buffer.from(this.result.info.pubkey, 'hex'));
  if(pubkey.length !== 32){
    this.result.pubkeyError = 'pubkey is expected to be 32'
    return false
  }
  return true
}

/*
  Event Emitters
*/
Inspector.prototype.check_read = function(benchmark) {
  const which = benchmark ? `latency-${this.latencies.length}` : 'read'
  const subid = this.key(which)

  if(this.opts.debug)
    console.log(this.relay.url, "check_read", `via: ${which}`, subid)

  this.relay.subscribe(subid, {limit: 1, kinds:[1]})

  this.timeout[which] = setTimeout(() => {
    if(this.opts.debug) 
      console.log(this.relay.url, "check_read_timeout", `via: ${which}`, subid)

    this.try_complete()
  }, this.opts.readTimeout)
}

Inspector.prototype.check_write = function() {
  const subid = this.key('write')

  if(this.opts.debug)
    console.log(this.relay.url, "check_write", subid)

  const event = this.opts.testEvent || config.testEvent

  if(this.opts.debug)
    console.log(this.relay.url, "test event", event.id)

  this.result.latency.begin.write = Date.now()
  this.relay.send(["EVENT", event])
  // this.relay.subscribe(subid, {limit: 1, kinds:[1], ids:[config.testEvent.id]})

  this.timeout.write = setTimeout(() => {
    this.result.check.write = false
    this.execute_next_check()
  }, this.opts.writeTimeout)
}

Inspector.prototype.check_latency = function() {
  if(this.result.check.read === false)
    return


  const key = `latency-${this.latencies.length}`
  const subid = this.key(key)
  
  this.result.count[key] = 0

  this.result.latency.begin[this.latencies.length] = Date.now()

  this.check_read(true)
}

Inspector.prototype.execute_next_check = async function(){
  console.log(this.relay.url, 'execute_next_check', this.checks.length)
  
  if(!this.checks.length)
    return this.try_complete()
  
  if(this.opts.delayBetweenChecks > 0) 
    await new Promise( resolve => setTimeout(resolve, this.opts.delayBetweenChecks))

  const fn = this.checks.shift()

  fn()
}

/* 
  Event Handlers
*/
Inspector.prototype.handle_event = function(subid, event) {
  const type = subid.split('_')[0]
  clearTimeout(this.timeout[type])
  if( this.do_handle_event(type) ) {
    if(this.opts.debug)
      console.log(this.relay.url, "handle_event", subid)

    if( wsIsOpen(this.relay.ws) )
      this.relay.unsubscribe(subid)

    if(!type.includes('latency')){
      this.log.push(['handled_event', `handled event from ${type} check'`])
      this.result.check[type] = true
    }
    else {
      this.handle_latencies()
    }
    this.execute_next_check()
  }
  this.result.count[type]++
}

Inspector.prototype.handle_latencies = function(){
  if(this.result.check.read === false)
    this.result.check.read = true

  const latency = Date.now() - this.result.latency.begin[this.latencies.length]
  this.latencies.push(latency)

  this.log.push([`latency`, `latency check #${this.latencies.length} was ${latency}ms `])

  if(this.latencies.length < this.opts.latencyPings){
    if( wsIsOpen(this.relay.ws) )
      this.relay.unsubscribe(this.key(`latency-${this.latencies.length}`))
    if(this.opts.debug)
      console.log(this.relay.url, 'check_latency', `${this.latencies.length}/${this.opts.latencyPings}`, `took ${latency}ms`)
  }
  else {
    this.result.latency.data = this.latencies
    if( wsIsOpen(this.relay.ws) )
      this.relay.unsubscribe(this.key(`latency-${this.latencies.length}`))
    this.result.check.latency = true
    this.try_complete()
  }
}

Inspector.prototype.do_handle_event = function(type){
  console.log('do_handle_event?', type, this.result.count[type], type.includes('latency') && this.result.count[type] < 1 && this.latencies.length <= this.opts.latencyPings, this.result.count[type] < 1)
  if(type.includes('latency') && this.result.count[type] < 1 && this.latencies.length <= this.opts.latencyPings) 
    return true
  if(this.result.count[type] < 1)
    return true 
}

/*
  Event Callbacks
*/

Inspector.prototype.on_open = async function(e) {
  if(this.opts.debug) 
    console.log(this.relay.url, "on_open")

  this.result.latency.connect = Date.now() - this.result.latency.begin.connect

  clearTimeout(this.timeout.connect)

  if(this.opts.debug)
    console.log(this.relay.url, 'cleared timeout', 'connect')

  this.result.check.connect = true

  if(this.opts.getInfo)
    await this.get_info()

  if(this.opts.checkRead)
    this.checks.push(() => this.check_read())

  if(this.opts.checkWrite)
    this.checks.push(() => this.check_write())

  if(this.opts.checkLatency) {
    for(let c=0;c<this.opts.latencyPings;c++){
      this.checks.push(() => this.check_latency())
    }
  }
  
  this.execute_next_check()
  this.cbcall("open", e, this.result)
}


Inspector.prototype.on_close = function(e) {
  if(this.opts.debug) 
    console.log(this.relay.url, "on_close")

  this.cbcall("close", e, this.result)
}

Inspector.prototype.on_eose = function(eose) {
  if(this.opts.debug)
    console.log(this.relay.url, "on_eose")

  this.cbcall("eose", eose, this.result)
}

Inspector.prototype.on_ok = function(ok) {
  if(this.opts.debug)
    console.log(this.relay.url, "on_ok")

  this.result.latency.write = Date.now() - this.result.latency.begin.write
  this.result.check.write = true 

  this.execute_next_check()

  this.cbcall("ok", ok)
}

Inspector.prototype.on_error = function(err) {
  if(this.opts.debug)
    console.log(this.relay.url, "on_error", err)

  if(this.result.count.error == 0 && this.state === 'pending') {
    clearTimeout(this.timeout.connect)
    this.hard_fail()
    this.cbcall("error", err)
  }
  this.result.count.error++
}

Inspector.prototype.on_event = function(subid, event) {
  // if(this.opts.debug)
  //   console.log(this.relay.url, "on_event", subid, event.id)

  this.handle_event(subid, event)

  this.cbcall("event", subid, event, this.result)
}

Inspector.prototype.on_notice = function(notice) {
  this.log.push(['notice', notice])
  this.cbcall("notice", notice, this.result)
}


Inspector.prototype.try_complete = function() {
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

    if(!this.result.check.connect && (this.result.check.read || this.result.check.write))
      this.result.check.connect = true

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

Inspector.prototype.connect_timeout = function(relay_url){
  if(this.opts.debug)
    console.log(relay_url, "connect_timeout_init")

  this.timeout.connect = setTimeout(() => {
    if(this.opts.debug)
      console.log(relay_url, "connect_timeout")
    this.hard_fail()
  }, this.opts.connectTimeout)
}

Inspector.prototype.hard_fail = function(){
  if(this.state === 'complete')
    return 
    
  if(this.opts.debug)
    console.log(this.relay.url, "hard_fail")

  this.result.check.connect = false
  this.result.check.read = false
  this.result.check.write = false
  this.result.check.latency = false
  this.try_complete()

  if(wsIsOpen(this.relay.ws))
    this.close()
}

Inspector.prototype.sha1 = function(message) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(message)).digest('hex')
  return hash
}

Inspector.prototype.on = function(method, fn) {
  this.cb[method] = fn
  return this
}

Inspector.prototype.cbcall = function(method) {
  [].shift.call(arguments,1)

  // console.log(this.relay.url, 'cbcall', method, ...arguments)

  if(typeof this.cb[method] === 'function')
    this.cb[method](...arguments)
}

const wsIsOpen = function(ws){
  if(!ws?.readyState || !ws?.OPEN)
    return
  return ws.readyState === ws.OPEN
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