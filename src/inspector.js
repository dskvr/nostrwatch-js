/* eslint-disable */
import config from '../config.yml'
import Observation from './observation.js'
import { Relay } from 'nostr'
import crypto from 'crypto'
import {Result, Opts, Inbox, Timeout, Info} from './types.js'

export default function Inspector(relay, opts={})
{
  this.cb = {}
  this.opts = Object.assign(structuredClone(Opts), opts)

  this.result = structuredClone(Result)
  this.inbox = structuredClone(Inbox)
  this.timeout = structuredClone(Timeout)
  // this.result.info = structuredClone(Info)
  this.instanced = false

  this.connect_timeout(relay)

  this.relay = (relay instanceof(Relay)) ? this.instanced=true && relay : new Relay(relay)
  this.result.state = 'pending'
  this.result.uri = this.relay.url

  if(this.opts.debug)
    console.log(relay, 'options', this.opts)

  // this.opts.checkNip[5] = true

  if(opts.run)
    this.run()

  return this
}

// PUBLIC

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

Inspector.prototype.getMessages = function(member) {
  if (!member)
    return this.inbox

  if (this.inbox.hasOwnProperty(member))
    return this.result[member]

  if(this.opts.debug)
    console.log('getMessage', 'What you are looking for does not exist')
}

Inspector.prototype.getInfo = async function(){
  const url = new URL(this.relay.url),
        headers = {
          "Accept": "application/nostr+json",
        }


  let res = await fetch(`https://${url.hostname}/`, { method: 'GET', headers: headers})
      .then(response => {
        try { JSON.parse(JSON.stringify(response)) } catch (e) { return false; }
        return response.json()
      })
      .catch(err => this.cbcall('error', err)) ;

  if(this.opts.debug)
    console.log(`https://${url.hostname}/`, 'check_nip_11', res)

  return res
}

Inspector.prototype.getIdentities = async function() {
  const url = new URL(this.relay.url)



  let res = await fetch(`https://${url.hostname}/.well-known/nostr.json`)
                    .then(response => response.json())
                    .catch(err => console.log(err));

  if(this.opts.debug)
    console.log(`https://${url.hostname}/`, 'check_nip_5', res)

  return res && Object.prototype.hasOwnProperty.call(res, 'names') ? res.names : false
}

Inspector.prototype.checkLatency = function(){
  this.check_latency()
}

Inspector.prototype.nip = function(nip_num){
  return this.result.nips[nip_num]
}

Inspector.prototype.reset = function(hard){
  this.result = structuredClone(Result)
}

Inspector.prototype.run = async function() {
  if(this.opts.debug) console.log(this.relay.url, "running")

  if(!this.opts.run) //if autorun don't call run callback.
    this.cbcall('run', this.result)

  const self = this

  if(!this.instanced)
    //Wrap nostr-js events
    this.relay
      .on('open',     (e) => self.on_open(e))
      .on('eose',     (e) => self.on_eose(e))
      .on('error',    (e) => self.on_error(e))
      .on('ok',       (e) => self.on_ok(e))
      .on('close',    (e) => self.on_close(e))
      .on('event',    (subid, event) => self.on_event(subid, event))
      .on('notice',   (notice) => self.on_notice(notice))

  return this
}

Inspector.prototype.key = function(id){
  return `${id}_${this.relay.url}`
}

Inspector.prototype.check_read = function(benchmark) {
  // if(this.opts.debug) console.log(this.relay.url, "check_read")
  const which = benchmark ? this.result.key.latency : this.result.key.read
  const subid = this.key(which)

  if(this.opts.debug)
    console.log(this.relay.url, "check_read", `via: ${which}`, subid)
//  if(benchmark) //debug.info(url, subid, this.result.latency.start)

  this.relay.subscribe(subid, {limit: 1, kinds:[1]})
  this.timeout[which] = setTimeout(() => {
    if(this.opts.debug) console.log(this.relay.url, "check_read_timeout", `via: ${which}`, subid)
    this.result.check[which] = false
    this.try_complete()
  }, config.millis.readTimeout)
}

Inspector.prototype.check_write = function(benchmark) {
  const subid = this.key(this.result.key.write)

  if(this.opts.debug)
    console.log(this.relay.url, "check_write", subid)

  const ev = config.testEvent
  this.relay.send(["EVENT", ev])
  this.relay.subscribe(subid, {limit: 1, kinds:[1], ids:[config.testEvent.id]})
  this.timeout.write = setTimeout(() => {
    //debug.info(url, "did write", id, false)
    if(!benchmark) this.result.check.write = false
    this.try_complete()
  }, config.millis.writeTimeout)
}

Inspector.prototype.check_latency = function() {
  const subid = this.key(this.result.key.latency)

  if(this.opts.debug)
    console.log(this.relay.url, "check_latency", subid)

  this.result.latency.start = Date.now()

  if(this.result.check.read)
    this.check_read(true)
}

Inspector.prototype.get_info = async function(){
  this.result.info = await this.getInfo()

  if(this.result.info && this.opts.passiveNipTests)
    this.result.nips[11] = true

  if(this.result.info.pubkey)
    this.result.identities = Object.assign(this.result.identities, { serverAdmin: this.result.info.pubkey })
}

Inspector.prototype.get_identities = async function(){
  const identities = await this.getIdentities()
  this.result.identities = Object.assign(this.result.identities, identities)
}

// Inspector.prototype.check_nips = async function() {
//   this.opts.checkNip.forEach( (test, nipKey) => { if(test) this.check_nip(nipKey) })
// }
//
// Inspector.prototype.check_nip = async function(nip) {
//   console.log(this.relay.url, "check_nip", nip);
//   this.result.nips[nip] = await nips[nip].test(this.relay.url)
//   if(this.result.nips[nip]) this.try_complete()
//   if(this.opts.debug) console.log(this.relay.url, "check_nip result", this.nips[nip])
// }

Inspector.prototype.handle_event = function(subid, event) {
  if(this.opts.debug)
    console.log(this.relay.url, "handle_event", subid, event)

  const method = `handle_${subid.split('_')[0]}`
  this.inbox.events.push(event)
  this[method](subid, event)
}

Inspector.prototype.handle_read = function(subid, event){
  if(this.opts.debug)
    console.log(this.relay.url, "handle_read", this.result.count.read)

  if(this.result.count.read < 1) {
    this.result.check.read = true
    this.relay.unsubscribe(subid)
    this.try_complete()

    if(this.opts.checkLatency)
      this.check_latency()

    setTimeout( () => { clearTimeout(this.timeout.read) }, config.millis.clearTimeoutBuffer)

    if(this.opts.debug)
      console.log(this.relay.url, 'cleared timeout', 'read', this.timeout.read)
  }
  this.result.count.read++
}

Inspector.prototype.handle_write = function(subid, event){
  if(this.opts.debug)
    console.log(this.relay.url, `handle_${subid.split('_')[0]}`)

  if(this.result.count.write < 1) {
    this.result.check.write = true

    setTimeout( () => { clearTimeout(this.timeout.write) }, config.millis.clearTimeoutBuffer)

    this.try_complete()

    if(this.opts.debug)
      console.log(this.relay.url, 'cleared timeout', 'write', this.timeout.write)
  }
  this.result.count.write++
}

Inspector.prototype.handle_latency = function(subid, event){
  if(this.opts.debug)
    console.log(this.relay.url, "handle_latency")

  if(this.result.count.latency < 1) {
    this.result.check.latency = true
    this.result.latency.final = Date.now() - this.result.latency.start

    this.try_complete()

    setTimeout( () => { clearTimeout(this.timeout.latency) }, config.millis.clearTimeoutBuffer)

    if(this.opts.debug)
      console.log(this.relay.url, 'cleared timeout', 'latency', this.timeout.latency)
  }
  this.result.count.latency++
}

// PRIVATE

// ON_OPEN
Inspector.prototype.on_open = function(e) {
  if(this.opts.debug) console.log(this.relay.url, "on_open")

  //debug.info(url, "OPEN")
  if(this.opts.debug) console.dir(this)

  setTimeout( () => {
    clearTimeout(this.timeout.connect)

    if(this.opts.debug)
      console.log(this.relay.url, 'cleared timeout', 'connect', this.timeout.connect)
  }, config.millis.clearTimeoutBuffer)

  this.result.check.connect = true

  if(this.opts.checkRead)
    this.check_read()

  if(this.opts.checkWrite)
    this.check_write()

  if(this.opts.getInfo)
    this.get_info()

  if(this.opts.getIdentities)
    this.get_identities()

  this.try_complete()
  this.cbcall("open", e, this.result)
}

// ON_CLOSE
Inspector.prototype.on_close = function(e) {
  if(this.opts.debug) console.log(this.relay.url, "on_close")
  this.cbcall("close", e, this.result)
}

// ON_EOSE
Inspector.prototype.on_eose = function(e) {
  if(this.opts.debug)
    console.log(this.relay.url, "on_eose")

  if(this.opts.passiveNipTests)
    this.result.nips[15] = true

  this.cbcall("eose", e, this.result)
}

// ON_OK
Inspector.prototype.on_ok = function(ok) {
  if(this.opts.debug)
    console.log(this.relay.url, "on_ok")

  if(this.opts.passiveNipTests)
    this.result.nips[20] = true

  this.cbcall("ok", ok)
}

// ON_ERROR
Inspector.prototype.on_error = function(err) {
  if(this.result.count.error == 0) {
    if(this.opts.debug)
      console.log(this.relay.url, "on_error")

    this.inbox.errors.push(err)
    clearTimeout(this.timeout.connect)
    this.result.observations['Reason: Error'] = {}
    this.hard_fail()
    this.cbcall("error", err)
  }
  this.result.count.error++
}

// ON_EVENT
Inspector.prototype.on_event = function(subid, event) {
  if(this.opts.debug)
    console.log(this.relay.url, "on_event", subid)
  this.handle_event(subid, event)
  this.cbcall("event", subid, event, this.result)
}

// ON_NOTICE
Inspector.prototype.on_notice = function(notice) {
  this.inbox.notices.push(notice)
  // this.result.observations[code_obj.description] = message_obj
  this.cbcall("notice", notice, this.result)
}

Inspector.prototype.try_complete = function() {
  if(this.opts.debug)
    console.log(this.relay.url, "try_complete")

  let connect = typeof this.result.check.connect !== 'object', //check null
      read = typeof this.result.check.read !== 'object' || this.opts.checkRead !== true,
      write = typeof this.result.check.write !== 'object' || this.opts.checkWrite !== true,
      latency = typeof this.result.check.latency !== 'object' || this.opts.checkLatency !== true

  if(connect && read && write && latency) {
    if(this.opts.debug)
      console.log(this.relay.url, "did_complete", connect, read, write, latency, this.result.check)

    this.result.state = 'complete'

    this.observe()

    if(!this.opts.keepAlive) this.relay.close()

    if(this.opts.debug) console.log(this.relay.url, 'checks', this.result.check)
    this.cbcall('complete', this)
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

    if(this.opts.debug)
      console.log(relay_url, "TIMEOUT")

    this.hard_fail()
  }, config.millis.connectTimeout)
}

Inspector.prototype.hard_fail = function(){
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

  if(typeof this.cb[method] === 'function')
    this.cb[method](...arguments)
}
