/* eslint-disable */
import settings from '../settings.yml'
import Observation from './observation.js'
import { Relay } from 'nostr'
import crypto from 'crypto'
import { nip05 } from './nips.js'

let RelayResult = {
  state: "standby",
  protocol: "",
  tor: false,
  latency: {
    start: null,
    final: null
  },
  identity: {
    name: ""
  },
  ip: "",
  geo: {},
  check: {
    connect: null,
    read: null,
    write: null,
    latency: null,
  },
  count: {
    read: 0,
    write: 0,
    latency: 0,
    error: 0
  },
  key: {
    read: "read",
    write: "write",
    latency: "latency"
  },
  nips: Array(99).fill(null), //1 based index!
  observations: [],
}

const Opts = {
  checkRead: true,
  checkWrite: true,
  checkLatency: false,
  checkNip05: false,
  keepAlive: false,
  getIp: false,
  getGeo: false,
  debug: false,
  run: false,
}

const Inbox = {
  notices: [],
  errors: [],
  events: [],
  other: []
}

const Timeout =  {
  connect: null,
  read: null,
  write: null,
  latency: null
}

export default function Inspector(relay, opts={})
{
  // if(!(this instanceof(Inspector)))
  //   return new Inspector(relay, opts)

  this.cb = {}
  this.opts = Object.assign(structuredClone(Opts), opts)

  this.result = structuredClone(RelayResult)
  this.inbox = structuredClone(Inbox)
  this.timeout = structuredClone(Timeout)

  this.connect_timeout(relay)

  this.relay = (relay instanceof(Relay)) ? relay : new Relay(relay)
  this.result.state = 'pending'

  if(this.opts.debug) console.log(relay, 'options', this.opts)

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

Inspector.prototype.getMessages = function(member) {
  if (!member)
    return this.inbox
  if (this.inbox.hasOwnProperty(member))
    return this.result[member]
  if(this.opts.debug) console.log('getMessage', 'What you are looking for does not exist')
}

Inspector.prototype.nip = function(nip_num){
  return this.result.nips[nip_num]
}

Inspector.prototype.checkLatency = function(){
  this.check_latency()
}

Inspector.prototype.reset = function(hard){
  this.result.check.connect = null
  this.result.check.read = null
  this.result.check.write = null
  this.result.check.latency = null

  this.result.check.read = 0
  this.result.check.write = 0
  this.result.check.latency = 0
}

Inspector.prototype.run = async function() {
  if(this.opts.debug) console.log(this.relay.url, "running")
  const self = this

  this.relay
    .on('open',     (e) => self.on_open(e))
    .on('eose',     (e) => self.on_eose(e))
    .on('error',    (e) => self.on_error(e))
    .on('ok',       (e) => self.on_ok(e))
    .on('close',    (e) => self.on_close(e))
    .on('event',    (subid, event) => self.on_event(subid, event))
    .on('notice',   (notice) => self.on_notice(notice))

  if(this.opts.setGeo) {
    await this.set_ip()
    await this.set_geo()
  }

  if(this.opts.checkNip05) await this.check_nip(5)

  return self
}

Inspector.prototype.key = function(id){
  return `${id}_${this.relay.url}`
}

Inspector.prototype.subid = function(id){
  return `${id}_${this.relay.url}`
}

Inspector.prototype.check_read = function(benchmark) {
  // if(this.opts.debug) console.log(this.relay.url, "check_read")
  const which = benchmark ? this.result.key.latency : this.result.key.read
  const subid = this.key(which)

  if(this.opts.debug) console.log(this.relay.url, "check_read", `via: ${which}`, subid)

//  if(benchmark) //debug.info(url, subid, this.result.latency.start)

  this.relay.subscribe(subid, {limit: 1, kinds:[1]})

  this.timeout[which] = setTimeout(() => {
    if(this.opts.debug) console.log(this.relay.url, "check_read_timeout", `via: ${which}`, subid)
    this.result.check[which] = false
    this.try_complete()
  }, 10000)
}

Inspector.prototype.check_write = function(benchmark) {
  const subid = this.key(this.result.key.write)
  if(this.opts.debug) console.log(this.relay.url, "check_write", subid)
  const message = {
    id: '41ce9bc50da77dda5542f020370ecc2b056d8f2be93c1cedf1bf57efcab095b0',
    pubkey:
      '5a462fa6044b4b8da318528a6987a45e3adf832bd1c64bd6910eacfecdf07541',
    created_at: 1640305962,
    kind: 1,
    tags: [],
    content: 'running branle',
    sig: '08e6303565e9282f32bed41eee4136f45418f366c0ec489ef4f90d13de1b3b9fb45e14c74f926441f8155236fb2f6fef5b48a5c52b19298a0585a2c06afe39ed'
  }

  this.relay.send(["EVENT", message])
  this.relay.subscribe(subid, {limit: 1, kinds:[1], ids:['41ce9bc50da77dda5542f020370ecc2b056d8f2be93c1cedf1bf57efcab095b0']})
  this.timeout.write = setTimeout(() => {
    //debug.info(url, "did write", id, false)
    if(!benchmark) this.result.check.write = false
    this.try_complete()
  }, 10000)
}

Inspector.prototype.check_latency = function() {
  const subid = this.key(this.result.key.latency)
  if(this.opts.debug) console.log(this.relay.url, "check_latency", subid)
  this.result.latency.start = Date.now()
  if(this.result.check.read) { this.check_read(true) }
}

Inspector.prototype.check_nip = async function(nip) {

  switch(nip){
    case 5:
      if(this.opts.debug)  onsole.log(this.relay.url, "check_nip", nip)
      let n5 = await nip05.searchDomain(this.relay.url)
      this.result.nips[5] = Object.keys(n5).length ? n5 : null
      if(this.result.nips[5]) this.try_complete()
      if(this.opts.debug) console.log(this.relay.url, "check_nip result", this.nips[5])
      break;
  }
}

Inspector.prototype.handle_event = function(subid, event) {
  if(this.opts.debug) console.log(this.relay.url, "handle_event", subid, event)
  const method = `handle_${subid.split('_')[0]}`
  this.inbox.events.push(event)
  this[method](subid, event)
  if(this.opts.debug) console.log('handle_event', method)
}

Inspector.prototype.handle_read = function(subid, event){
  if(this.opts.debug) console.log(this.relay.url, "handle_read", this.result.count.read)
  if(this.result.count.read < 1) {
    this.result.check.read = true
    this.relay.unsubscribe(subid)
    this.try_complete()
    if(this.opts.checkLatency) this.check_latency()
    setTimeout( () => { clearTimeout(this.timeout.read) }, 1000)
    if(this.opts.debug) console.log(this.relay.url, 'cleared timeout', 'read', this.timeout.read)
  }
  this.result.count.read++
}

Inspector.prototype.handle_write = function(subid, event){
  if(this.opts.debug) console.log(this.relay.url, `handle_${subid.split('_')[0]}`)
  if(this.result.count.write < 1) {
    this.result.check.write = true
    setTimeout( () => { clearTimeout(this.timeout.write) }, 1000)
    if(this.opts.debug) console.log(this.relay.url, 'cleared timeout', 'write', this.timeout.write)
    this.try_complete()
  }
  this.result.writeEventCount++
}

Inspector.prototype.handle_latency = function(subid, event){
  if(this.opts.debug) console.log(this.relay.url, "handle_latency")
  if(this.result.count.latency < 1) {
    this.result.check.latency = true
    this.result.latency.final = Date.now() - this.result.latency.start
    this.try_complete()
    setTimeout( () =>{ clearTimeout(this.timeout.latency) }, 1000)
    if(this.opts.debug) console.log(this.relay.url, 'cleared timeout', 'latency', this.timeout.latency)
  }
  this.result.latencyEventCount++
}

// PRIVATE

// ON_OPEN
Inspector.prototype.on_open = function(e) {
  if(this.opts.debug) console.log(this.relay.url, "on_open")

  //debug.info(url, "OPEN")
  if(this.opts.debug) console.dir(this)

  setTimeout( () => {
    clearTimeout(this.timeout.connect)
    if(this.opts.debug) console.log(this.relay.url, 'cleared timeout', 'connect', this.timeout.connect)
  }, 1000)

  this.result.check.connect = true

  if(this.opts.checkRead) this.check_read()

  if(this.opts.checkWrite) this.check_write()



  this.try_complete()

  //debug.info(url, "did connect", this.result.check.connect)

  this.cbcall("open", e, this.result)
}

// ON_CLOSE
Inspector.prototype.on_close = function(e) {
  if(this.opts.debug) console.log(this.relay.url, "on_close")
  this.cbcall("close", e, this.result)
}

// ON_EOSE
Inspector.prototype.on_eose = function(e) {
  if(this.opts.debug) console.log(this.relay.url, "on_eose")

  this.result.nips[15] = true

  this.cbcall("eose", e, this.result)
}

// ON_OK
Inspector.prototype.on_ok = function(ok) {
  if(this.opts.debug) console.log(this.relay.url, "on_ok")

  this.cbcall("ok", ok)

  this.result.nips[20] = true
}

// ON_ERROR
Inspector.prototype.on_error = function(err) {
  if(this.result.count.error == 0) {
    if(this.opts.debug) console.log(this.relay.url, "on_error")
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
  if(this.opts.debug) console.log(this.relay.url, "on_event", subid)
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
  if(this.opts.debug) console.log(this.relay.url, "try_complete")
  let connect = typeof this.result.check.connect !== 'object', //check null
      read = typeof this.result.check.read !== 'object' || this.opts.checkRead !== true,
      write = typeof this.result.check.write !== 'object' || this.opts.checkWrite !== true,
      latency = typeof this.result.check.latency !== 'object' || this.opts.checkLatency !== true

  if(connect && read && write && latency) {
    if(this.opts.debug) console.log(this.relay.url, "did_complete", connect, read, write, latency, this.result.check)
    //debug.info(url, 'did complete')
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

Inspector.prototype.set_ip = async function get_ip() {
  if(this.opts.debug) console.log(this.relay.url, "get_ip")
  //debug.warning('this uses public apis and may leak your ip!')
  let ip
  await fetch(`https://1.1.1.1/dns-query?name=${this.relay.url.replace('wss://', '')}`, { headers: { 'accept': 'application/dns-json' } })
    .then(response => response.json())
    .then((data) => { ip = data.Answer ? data.Answer[data.Answer.length-1].data : false });
  this.result.ip = ip
  return
}

Inspector.prototype.set_geo = async function() {
  if(this.opts.debug) console.log(this.relay.url, "get_geo")
  //debug.warning('this uses public apis and may leak your ip!')
  if (!this.result.ip) return
  await fetch(`https://ip-api.com/json/${this.result.ip}`, { headers: { 'accept': 'application/dns-json' } })
    .then(response => response.json())
    .then((data) => { this.result.geo = data });
  // alert(this.result.geo)
  return
}

Inspector.prototype.connect_timeout = function(relay_url){
  if(this.opts.debug) console.log(relay_url, "connect_timeout_init")
  this.timeout.connect = setTimeout(() => {
    if(this.opts.debug) console.log(relay_url, "connect_timeout")
    if(this.opts.debug) console.log(relay_url, "TIMEOUT")
    // if(Object.keys(this.result.notes).length == 0) this.result.notes['Reason: Timeout'] = {}
    this.hard_fail()
  }, 20000)
}

Inspector.prototype.hard_fail = function(){
  if(this.opts.debug) console.log(this.relay.url, "hard_fail")
  this.result.check.connect = false
  this.result.check.read = false
  this.result.check.write = false
  this.result.check.latency = false
  this.try_complete()
  if(this.relay.close) this.relay.close()
}

Inspector.prototype.sha1 = function(message) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(message)).digest('hex')
  // if(this.opts.debug) console.log(message, ':', hash)
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

// let arr = ['wss://nostr.sandwich.farm', 'wss://none.sandwich.farm', 'wss://relay.nostr.rocks', 'wss://relay.damus.io']
// arr.forEach( async relay => {
//   let inspect = new Inspector(relay)
//   inspect.run()
// })
