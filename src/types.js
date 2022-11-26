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
  passiveNipTests: true,
  checkNips: true,
  checkNip: Array(settings.nipsTotal+1).fill(null),
  keepAlive: false,
  // getIp: false,
  // getGeo: false,
  debug: false,
  run: false
}

//Check widely supported nips by default
[1,2,3,4,5,9,11,12,13,15,16,20,22,26,33].forEach(nip => {
  checkNip[nip] = true
})

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
