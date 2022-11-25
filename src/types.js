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
  nips: Array(99).fill(null), //1 based index!
  observations: [],
}

export const Opts = {
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
