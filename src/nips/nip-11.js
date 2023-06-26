import Nips from './nips.js'
import schema from './nip-11.schema.js'
import {getNip11} from '../helpers.js'

const NIP = 11
const DEPENDENCIES = []
const USE_RELAY_WRAPPER = false

export default class Nip11 extends Nips {

  constructor(url, options) {
    options = Object.assign(options, { useRelayWrapper: USE_RELAY_WRAPPER })
    super(url, NIP, options)
    this.schema = schema
    this.deps = DEPENDENCIES
  }

  async validate(){
    this.pass = this.validateSchema(this.nip, this.schema, this.data)
    return this.pass
  }

  async run(){
    return getNip11(this.url, {
      onSuccess: () => {
        this.log(`success`, `NIP-11: info document was fetched and parsed in ${this.result.latency.nip11}ms`)
      },
      onError: (error) => {
        if(error === 'errorFetch')
          this.log('error', 'Host returned an error when attempting to fetch NIP-11 info document')
        if(error === 'errorJsonParse')
          this.log('error', 'Could not parse NIP-11 information document')
      },
      onTimeout: () => {
        this.log(`timeout`, `NIP-11: info document was not returned within 10000 milliseconds`)
      }
    })
  }  
}