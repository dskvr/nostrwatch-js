import config from '../config.js'

export const Result = {
  uri: "",
  state: "standby",
  info: {},
  protocol: "",
  tor: false,
  latency: {
    start: null,
    final: null
  },
  identities: {},
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
  nips: Array(config.nipsTotal+1).fill(null), //1 based index!
  observations: [],
}

export const Opts = {
  checkRead: true,
  checkWrite: true,
  checkLatency: true,
  passiveNipTests: true,
  getInfo: true,
  getIdentities: true,
  checkNips: true,
  checkNip: Array(config.nipsTotal+1).fill(null),
  resetNips: false,
  keepAlive: false,
  // getIp: false,
  // getGeo: false,
  debug: false,
  run: false,
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
  other: []
}

export const Timeout =  {
  connect: null,
  read: null,
  write: null,
  latency: null
}
