/* eslint-disable */
import Observation from './observation.js'
import { Relay } from 'nostr'
import crypto from 'crypto'
// import { isValidSSL } from 'ssl-validator'
import sslChecker from 'ssl-checker'
import { Result, Opts, Timeout } from './types.js'
import config from '../config/index.js'
import { isJson } from './util.js'
import fetch from 'cross-fetch'

export default function Inspector(relay, opts={})
{
  this.setup(opts)
  this.relay =  new Relay(relay, {reconnect: false})
  this.result.state = 'pending'
  this.result.url = this.relay.url

  if(this.opts.run)
    this.run()
  
  if(!this.relay.onfn.open)
    this.relay
      .on('open',     (e) => this.on_open(e))

  return this
}

// PUBLIC
Inspector.prototype.run = async function() {
  if(this.opts.debug) 
    console.log(this.relay.url, "running")

  this.connect_timeout(this.relay.url)

  // if(!this.instanced)
  //Wrap nostr-js events

  this.relay
      .on('eose',(e) =>               this.on_eose(e) )
      .on('error',(e) =>              this.on_error(e) )
      .on('ok',(e) =>                 this.on_ok(e) )
      .on('close',(e) =>              this.on_close(e) )
      .on('event',(subid, event) =>   this.on_event(subid, event) )
      .on('notice',(notice) =>             this.on_notice(notice) )

  if(!this.opts.run) //only call if not autorun
    this.cbcall('run', this.result)

  return this
}

Inspector.prototype.close = async function() {
  this.relay.close()
} 

Inspector.prototype.setup = function(opts){
  this.cb = {}
  this.opts = Object.assign(structuredClone(Opts), opts)

  this.result = structuredClone(Result)
  this.timeout = structuredClone(Timeout)
  this.instanced = false
  this.promises = {}
  this.log = new Array()

  if(this.opts?.data !== null) { 
    this.result = this.opts?.data?.result ? Object.assign(this.result, this.opts.data.result) : this.result
    this.log = this.opts?.data?.log || this.log
  }

  if(this.opts.debug)
    console.log('options', this.opts)
}

Inspector.prototype.get = function(member) {
  if (!member)
    return this.result

  if (this.result.hasOwnProperty(member))
    return result[member]
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

// Inspector.prototype.getInbox = function(member) {
//   if (!member)
//     return this.log

//   if (this.log.hasOwnProperty(member))
//     return this.result[member]

//   if(this.opts.debug)
//     console.log('getMessage', 'What you are looking for does not exist')
// }

Inspector.prototype.getInfo = async function(){
  if(this.result?.info && Object.keys(this.result?.info).length)
    return this.result.info

  return await this.getInfoRemote()
}

Inspector.prototype.getInfoRemote = async function(){
  const url = new URL(this.relay.url),
        headers = {
          "Accept": "application/nostr+json",
        }

  let res = await fetch(`https://${url.hostname}/`, { method: 'GET', headers: headers})
      .then(response => response.json().catch( err => { 
        console.error(`${this.relay.url}`, err) 
        this.log.push(['error', err])
      }) )
      .catch(err => {
        console.error(`${this.relay.url}`, err) 
        this.log.push(['error', err])
      });

  if(this.opts.debug)
    console.log(`https://${url.hostname}/`, 'check_nip_11', res)

  return res
}

Inspector.prototype.getIdentities = async function() {
  const url = new URL(this.relay.url)

  try {
    let res = await fetch(`https://${url.hostname}/.well-known/nostr.json`)
                      .then(response => isJson(response) ? response.json().catch( err => { 
                          console.error(`${this.relay.url}`, err) 
                          this.log.push(['error', err])
                        }) : false)
                      .catch(err => {
                        console.error(`getIdentities() 404 ${this.relay.url}`, err)
                        this.log.push(['error', err])
                      });

    if(this.opts.debug)
      console.log(`https://${url.hostname}/`, 'check_nip_5', res)
    
    return res?.names ? res.names : false
  } catch(err) {
    console.error(`${this.relay.url}`, err)
    this.log.push(['error', err])
    return  false
  }
}

Inspector.prototype.checkLatency = function(){
  return this.check_latency()
}

Inspector.prototype.nip = function(nip_num){
  return this.result.nips[nip_num]
}

Inspector.prototype.reset = function(hard){
  this.result = structuredClone(Result)
}

Inspector.prototype.key = function(id){
  return `${id}_${this.relay.url}`
}

Inspector.prototype.get_info = async function(){

  this.result.info = await this.getInfo()

  if(this.result?.info && this.opts.passiveNipTests)
    this.info?.supported_nips.forEach(nip => this.result.nips[nip] = true)

  if(this.result?.info?.pubkey)
    this.result.identities = Object.assign(this.result.identities, { serverAdmin: this.result.info.pubkey })

  if(this.opts.debug)
    console.log('get_info', this.result.info)

  return true
}

Inspector.prototype.get_identities = async function(){
  const identities = await this.getIdentities()
  this.result.identities = Object.assign(this.result.identities, identities)
}

Inspector.prototype.check_read = function(benchmark) {
  const which = benchmark ? 'latency' : 'read'
  const subid = this.key(which)

  if(this.opts.debug)
    console.log(this.relay.url, "check_read", `via: ${which}`, subid)

  this.relay.subscribe(subid, {limit: 1, kinds:[1]})

  this.timeout[which] = setTimeout(() => {
    if(this.opts.debug) 
      console.log(this.relay.url, "check_read_timeout", `via: ${which}`, subid)

    if(!this.result.check[which]) //only set to false if null, latency may have set read to true.
      this.result.check[which] = false

    // if(which == 'latency' && this.result.check.read){
    //   if(this.opts.debug) 
    //     console.log(this.relay.url, "check_read_timeout", `via: ${which}`, subid)
    //   this.check_latency()
    // }

    this.try_complete()
  }, this.opts.readTimeout)
}

Inspector.prototype.check_ssl = async function() {

  const url = new URL(this.relay.url)

  console.log(url.hostname, "check_ssl()")
    
  this.result.check.ssl = true

  try {
    const res = await sslChecker(url.hostname);;
    if(res.daysRemaining <= 0 || !res.valid) {
      this.result.check.ssl = false
    }
  } catch(err)  {
    this.result.check.ssl = false
  }
  
  // if(this.opts.debug)
  console.log(url, "check_ssl()", this.result.check.ssl)

  this.try_complete()
  
  return this.result.check.ssl

};

Inspector.prototype.check_write = function(benchmark) {
  const subid = this.key('write')

  if(this.opts.debug)
    console.log(this.relay.url, "check_write", subid)

  const event = this.opts.testEvent || config.testEvent

  if(this.opts.debug)
    console.log(this.relay.url, "test event", event)

  this.relay.send(["EVENT", event])
  this.relay.subscribe(subid, {limit: 1, kinds:[1], ids:[config.testEvent.id]})

  this.timeout.write = setTimeout(() => {
    //debug.info(url, "did write", id, false)
    if(!benchmark) this.result.check.write = false
    this.try_complete()
  }, this.opts.writeTimeout)
}

Inspector.prototype.check_latency = function() {
  const subid = this.key('latency')

  if(this.opts.debug)
    console.log(this.relay.url, "check_latency", subid)

  this.result.latency.start = Date.now()

  this.check_read(true)
}

/* 
  Event Handlers
*/
Inspector.prototype.handle_event = function(subid, event) {
  if(this.opts.debug)
    console.log(this.relay.url, "handle_event", subid, event)

  const type = subid.split('_')[0]
  const method = `handle_${type}`

  if(this.opts.debug)
    console.log(this.relay.url, method)

  if(this.result.count[type] < 1) {
    this.log.push(['event', event])

    this.result.check[type] = true

    if("latency" == type)
      this.result.latency.final = Date.now() - this.result.latency.start
      if(!this.result.check.read) //if there's latency, there's a read, force read to true
        this.result.check.read = true

    this.try_complete()

    setTimeout( () => { 
      clearTimeout(this.timeout[type])
      if(this.opts.debug)
        console.log(this.relay.url, 'cleared timeout', type, this.timeout[type])
    }, config.millis.clearTimeoutBuffer)
  }

  this.result.count[type]++
}

/*
  Event Callbacks
*/

Inspector.prototype.on_open = async function(e) {
  if(this.opts.debug) 
    console.log(this.relay.url, "on_open")

  //debug.info(url, "OPEN")
  if(this.opts.debug) 
    console.dir(this)

  setTimeout( () => {
    clearTimeout(this.timeout.connect)
    if(this.opts.debug)
      console.log(this.relay.url, 'cleared timeout', 'connect', this.timeout.connect)
  }, config.millis.clearTimeoutBuffer)

  this.result.check.connect = true

  if(this.opts.getInfo)
    await this.get_info()

  if(this.opts.getIdentities)
    await this.get_identities()
  
  if(this.opts.checkSsl)
    await this.check_ssl()

  if(this.opts.checkRead)
    this.check_read()

  if(this.opts.checkWrite)
    this.check_write()

  if(this.opts.checkLatency)
    this.check_latency()

  

  this.try_complete()
  this.cbcall("open", e, this.result)
}

Inspector.prototype.on_close = function(e) {
  if(this.opts.debug) console.log(this.relay.url, "on_close")
  this.cbcall("close", e, this.result)
}

Inspector.prototype.on_eose = function(eose) {
  if(this.opts.debug)
    console.log(this.relay.url, "on_eose")

  if(this.opts.passiveNipTests)
    this.result.nips[15] = true

  this.log.push(['eose', eose])

  this.cbcall("eose", eose, this.result)
}

Inspector.prototype.on_ok = function(ok) {
  if(this.opts.debug)
    console.log(this.relay.url, "on_ok")

  if(this.opts.passiveNipTests)
    this.result.nips[20] = true
  
  this.log.push(['ok', ok])

  this.cbcall("ok", ok)
}

Inspector.prototype.on_error = function(err) {
  if(this.opts.debug)
    console.log(this.relay.url, this.state, "on_error", err)

  if(this.result.count.error == 0 && this.state === 'pending') {
    clearTimeout(this.timeout.connect)
    this.hard_fail()
    this.cbcall("error", err)
  }
  this.result.count.error++
}

Inspector.prototype.on_event = function(subid, event) {
  if(this.opts.debug)
    console.log(this.relay.url, "on_event", subid)

  this.handle_event(subid, event)

  this.cbcall("event", subid, event, this.result)
}

Inspector.prototype.on_notice = function(notice) {
  this.log.push(['notice', notice])
  // this.result.observations[code_obj.description] = message_obj
  this.cbcall("notice", notice, this.result)
}


Inspector.prototype.try_complete = function() {
  let connect = this.result.check.connect !== null, //check null
      read = this.result.check.read !== null || this.opts.checkRead !== true,
      write = this.result.check.write !== null || this.opts.checkWrite !== true,
      latency = this.result.check.latency !== null || this.opts.checkLatency !== true,
      ssl = this.result.check.ssl !== null || this.opts.checkSsl !== true

  const didComplete = connect && read && write && latency && ssl

  if(this.opts.debug)
    console.log(this.relay.url, "try_complete", `state: ${this.result.state}`, connect, read, write, latency, this.result.check)

  if(didComplete) {
    if(this.result.state === 'complete')
      return

    if(this.opts.debug)
      console.log(this.relay.url, "did_complete", connect, read, write, latency, this.result.check)

    this.result.state = 'complete'
    // this.result.inbox = this.getInbox()

    if(!this.opts.keepAlive) 
      this.relay.close()

    if(this.opts.debug) 
      console.log(this.relay.url, 'checks', this.result.check)
    
    this.cbcall('complete', this)

    console.log('ssl', this.result.check.ssl) 
  }
}

Inspector.prototype.observe = function() {
  if(this.opts.debug) console.log(this.relay.url, "observe")
  if(this.result.count.read > 1)
    this.result.observations.push(new Observation('caution', 'FILTER_LIMIT_IGNORED', `The relay ignored the "limit" parameter during subscription and returned more events than were asked for. Asked for 1 but recieved ${this.result.count.read}`, 'sub:filter:limit'))
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

  if(this.relay.close)
    this.relay.close()
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
