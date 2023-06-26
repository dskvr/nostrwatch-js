import config from '../config/index.js'


export const Result = {
  url: "",
  state: "standby",
  info: {},
  protocol: "",
  tor: false,
  latency: {
    begin: {},
    end: {},
    start: null,
    final: null,
  },
  identities: {},
  ip: "",
  geo: {},
  check: {
    connect: null,
    read: null,
    write: null,
    latency: null,
    averageLatency: null,
    spamMitigation: null
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
  nips: Array(config.nipsTotal+1).fill(null), //1 based index!
  observations: [],
  pubkeyValid: null,
  pubkeyError: ''
}
  
export const Opts = {
  checkRead: true,
  checkWrite: true,
  checkLatency: true,
  checkAverageLatency: true,
  checkSpamMitigation: false,
  passiveNipTests: true,
  getInfo: true,
  checkNips: true,
  checkNip: Array(config.nipsTotal+1).fill(null),
  resetNips: false,
  keepAlive: false,
  // getIp: false,
  // getGeo: false,
  debug: false,
  run: false,
  connectTimeout: 15000,
  readTimeout: 15000,
  writeTimeout: 15000,
  latencyPings: 5,
  delayBetweenChecks: 100
}

export const Info = {
  pubkey: "",
  contact: "",
  software: "",
  version: "0.0.0",
  supported_nips: [],
  description: ""
}

export const Geo = {
  status: null,
  country: "",
  countryCode: "",
  region: "",
  regionName: "",
  city: "",
  zip: "",
  lat: 0.0,
  lon: 1.0,
  timezone: "",
  isp: "",
  org: "",
  as: "",
  query: "",
  dns: {},
}

export const Inbox = {
  notices: [],
  errors: [],
  events: [],
  other: [],
  ok: [],
  eose: []
}

export const Timeout =  {
  connect: null,
  read: null,
  write: null,
  latency: null,
  info: null, 
  identities: null,
}

export const NipOptions = {
  timeout: 10000,
  autorun: false
}

