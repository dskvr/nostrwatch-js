import settings from '../settings.yml'

export const Result = {
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
  nips: Array(settings.nipsTotal+1).fill(null), //1 based index!
  observations: [],
}

export const Opts = {
  checkRead: true,
  checkWrite: true,
  checkLatency: false,
  checkNip: Array(settings.nipsTotal+1).fill(null),
  keepAlive: false,
  getIp: false,
  getGeo: false,
  debug: false,
  run: false,
}

Opts.checkNip[1] = true
Opts.checkNip[2] = true
Opts.checkNip[3] = true
Opts.checkNip[4] = true
Opts.checkNip[9] = true
Opts.checkNip[11] = true
Opts.checkNip[12] = true
Opts.checkNip[13] = true
Opts.checkNip[15] = true
Opts.checkNip[15] = true
Opts.checkNip[16] = true
Opts.checkNip[20] = true
Opts.checkNip[22] = true
Opts.checkNip[26] = true
Opts.checkNip[33] = true


export const Inbox = {
  notices: [],
  errors: [],
  events: [],
  other: []
}

export const Timeout =  {
  connect: null,
  read: null,
  write: null,
  latency: null
}
