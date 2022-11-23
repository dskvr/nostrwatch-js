import settings from '../settings.yml'
import Observation from './observation.js'
import { Relay } from 'nostr'

const RelayStatus = {
  state: "waiting",
  protocol: "",
  tor: false,
  latency: {},
  identity: {
    name: ""
  },
  ip: "",
  geo: {},
  check: {
    connect: null,
    read: null,
    write: null,
  },
  count: {
    read: 0,
    write: 0,
    latency: 0
  },
  key: {
    read: "read",
    write: "write",
    latency: "latency"
  },
  timeout : {
    connect: null,
    read: null,
    write: null,
    latency: null
  },
  events: [],
  notices: [],
  nips: Array(99).fill(null), //1 based index!
  observations: [],
}

const Opts = {
  getIp: false,
  getGeo: false
}

const Inbox = {
  notices: [],
  errors: [],
  events: [],
  other: []
}

export default function Inspector(relay, opts={})
{
  if(!(this instanceof(Inspector)))
    return new Inspector(relay, opts)

  this.cb = {}
  this.opts = Opts
  this.status = RelayStatus
  this.inbox = Inbox

  this.connect_timeout(relay)
  this.relay = (relay instanceof(Inspector)) ? relay : Relay(relay)
  this.state = "pending"

  // if(opts.run)
  //   this.run()

  return this
}

// PUBLIC
Inspector.prototype.get = function(member) {
  if (!member)
    return this.status
  if (this.status.hasOwnProperty(member))
    return status[member]
}

Inspector.prototype.nip = function(nip_num){
  return this.status.nips[nip_num]
}

Inspector.prototype.run = async function() {
  console.log(this.relay.url, "running")
  const self = this
  this.relay
    .on('open',       (e) => self.on_open(e)             )
    .on('eose',       (e) => self.on_eose(e)             )
    .on('error',      (e) => self.on_error(e)            )
    .on('ok',         (e) => self.on_ok(e)               )
    .on('close',      (e) => self.on_close(e)            )
    .on('event',      (subid, event) => self.on_event(subid, event))
    .on('notice',     (notice) => self.on_notice(notice)     )


  if(this.opts.setIP) {
    await this.set_ip()
    if(this.opts.setGeo)
      await this.set_geo()
  }
}

Inspector.prototype.key = function(id){
  return `${id}_${this.relay.url}`
}

Inspector.prototype.subid = function(id){
  return `${id}_${this.relay.url}`
}

Inspector.prototype.test_read = function(benchmark) {
  // console.log(this.relay.url, "test_read")
  const id = benchmark ? this.status.key.latency : this.status.key.read
  const subid = this.key(id)

  console.log(this.relay.url, "test_read", id, subid)

  if(benchmark) this.status.latency.start = Date.now()
  if(benchmark) //debug.info(url, subid, this.status.latency.start)

  this.relay.subscribe(subid, {limit: 10, kinds:[1]})

  this.status.timeout[id] = setTimeout(() => {
    if(!benchmark) this.status.check.read = false
    this.try_complete()
  }, 10000)
}

Inspector.prototype.test_write = function(benchmark) {
  const subid = this.key(this.status.key.write)
  console.log(this.relay.url, "test_write", subid)
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
  this.status.timeout.write = setTimeout(() => {
    //debug.info(url, "did write", id, false)
    if(!benchmark) this.status.check.write = false
    this.try_complete()
  }, 10000)
}

// PRIVATE

// ON_OPEN
Inspector.prototype.on_open = function(e) {
  console.log(this.relay.url, "on_open")

  //debug.info(url, "OPEN")
  console.dir(this)
  clearTimeout(this.status.timeout.connect)
  this.status.check.connect = true

  this.test_read()
  this.test_write()
  this.try_complete()

  //debug.info(url, "did connect", this.status.check.connect)

  this.cbcall("open", e)
}

// ON_CLOSE
Inspector.prototype.on_close = function(e) {
  console.log(this.relay.url, "on_close")
  this.cbcall("close", e)
}

// ON_EOSE
Inspector.prototype.on_eose = function(e) {
  console.log(this.relay.url, "on_eose")

  // this.try_complete(this.relay.url)

  this.cbcall("eose", e)
  this.status.nips[15] = true
}

// ON_OK
Inspector.prototype.on_ok = function(ok) {
  console.log(this.relay.url, "on_ok")
  this.cbcall("ok", ok)
  this.status.nips[20] = true
}

// ON_ERROR
Inspector.prototype.on_error = function(err) {
  console.log(this.relay.url, "on_error")
  clearTimeout(this.status.timeout.connect)
  this.status.observations['Reason: Error'] = {}
  this.hard_fail()
  this.cbcall("error", err)
}

// ON_EVENT
Inspector.prototype.on_event = function(subid, event) {
  console.log(this.relay.url, "on_event", subid)
  this.handle_event(subid, event)
  this.cbcall("event", subid, event)
}

// ON_NOTICE
Inspector.prototype.on_notice = function(notice) {
  console.log(this.relay.url, "on_notice")
  const hash = this.sha1(notice)
  let   message_obj = RELAY_MESSAGES[hash]
  let   code_obj = RELAY_CODES[message_obj.code]

  message_obj.type = code_obj.type
  message_obj.hash = hash

  // this.status.observations[code_obj.description] = message_obj
  this.cbcall("notice", notice)
}


Inspector.prototype.handle_event = function(subid, event) {
  console.log(this.relay.url, "handle_event", subid)
  const method = `handle_${subid.split('_')[0]}`
  console.log('handle_event', method)
  this[method](event)
  this.inbox.events.push(event)
}

Inspector.prototype.handle_read = function(event){
  console.log(this.relay.url, "handle_read")
  //debug.info(url, "read", "success")
  this.status.count.read++
  this.status.check.read = true
  this.relay.unsubscribe(subid)
  this.try_complete()
  //
  clearTimeout(this.status.timeout.read)
}

Inspector.prototype.handle_write = function(event){
  console.log(this.relay.url, "handle_write")
  if(this.status.count.write < 1) {
    this.status.check.write = true
    clearTimeout(this.status.timeout.write)
    this.try_complete()

    //debug.info(url, "write", "success")
  }
  this.status.writeEventCount++
}

Inspector.prototype.handle_latency = function(event){
  console.log(this.relay.url, "handle_latency")
  if(this.status.count.latency < 1) {
    clearTimeout(this.status.timeout.latency)
    this.status.latency.final = Date.now() - this.status.latency.start
    this.setLatency(url)

    //debug.info(url, "SUCCESS:", "test latency")
  }
  this.status.latencyEventCount++
}

Inspector.prototype.try_complete = function() {
  console.log(this.relay.url, "try_complete")
  let connect = typeof this.status.check.connect !== 'object', //check null
      read = typeof this.status.check.read !== 'object',
      write = typeof this.status.check.write !== 'object'

  console.log(this.relay.url, "try_complete", connect, read, write)

  if(connect && read && write) {
    console.log(this.relay.url, "try_complete", "complete", true)
    //debug.info(url, 'did complete')
    this.status.state = 'complete'
    this.observe()
    this.cbcall('complete', this)
    this.relay.close()
    console.log('checks', this.status.check)
    console.dir(this)
  }
}

Inspector.prototype.observe = function() {
  console.log(this.relay.url, "observe")
  if(this.status.count.read > 1)
    this.observations.push(new Observation('FILTER_LIMIT_IGNORED', 'The relay returned more events than were asked for', 'sub:filter:limit'))
}

Inspector.prototype.get_ip = async function get_ip() {
  console.log(this.relay.url, "get_ip")
  //debug.warning('this uses public apis and may leak your ip!')
  let ip
  await fetch(`https://1.1.1.1/dns-query?name=${url.replace('wss://', '')}`, { headers: { 'accept': 'application/dns-json' } })
    .then(response => response.json())
    .then((data) => { ip = data.Answer ? data.Answer[data.Answer.length-1].data : false });
  this.status.ip = ip
}

Inspector.prototype.get_geo = async function() {
  console.log(this.relay.url, "get_geo")
  //debug.warning('this uses public apis and may leak your ip!')
  if (!this.status.ip) return
      await fetch(`http://ip-api.com/json/${this.status.ip}`, { headers: { 'accept': 'application/dns-json' } })
        .then(response => response.json())
        .then((data) => { this.status.geo = data });
}



Inspector.prototype.connect_timeout = function(relay_url){
  console.log(relay_url, "connect_timeout_init")
  this.status.timeout.connect = setTimeout(() => {
    console.log(relay_url, "connect_timeout")
    console.log(relay_url, "TIMEOUT")
    // if(Object.keys(this.status.notes).length == 0) this.status.notes['Reason: Timeout'] = {}
    this.hard_fail()
  }, 20000)
}

Inspector.prototype.hard_fail = function(){
  console.log(this.relay.url, "hard_fail")
  this.status.check.connect = false
  this.status.check.read = false
  this.status.check.write = false
  this.try_complete()
  if(this.relay.close)
    this.relay.close()
}

Inspector.prototype.on = function(method, fn) {
  this.cb[method] = fn
  return this
}

Inspector.prototype.cbcall = function(method) {
  // const _method = `on_${method}`
  // if(typeof this.cb[_method] === 'function')
  //   this.cb[_method](...arguments.shift())
}
