import { RelayWrapper } from './relay-wrapper.js'

import { NipOptions } from '../types.js'
import { hashString, uuid } from '../utils.js'

import { getNipKey } from '../utils.js'

import Deferred from 'promise-deferred'

import NipDeps from './nip-deps.js'

import Ajv from 'ajv'
const ajv = new Ajv()

export default class Nips extends RelayWrapper {
  constructor(nip, url, options = {}) {
    if(options.useRelayWrapper)
      super(options?.$relay || url )
    
    this.url = url
    this.data = {}
    this.nip = nip
    this.logData = []
    this.deps = []

    this.pass = false

    this.testing = options?.testing || []
    this.supported = options?.supported || []
    this.passing = options?.passing || []
    this.failing = options?.failing || []

    this.opts = Object.assign(NipOptions, options || {})
    this.subid = uuid()

    if(this.opts?.autorun){
      this.promise = new Deferred()
      this.test()
      this.promise.resolve()
    }
    
    this.setDeps()
  }

  setup(url, options){
    this.options = Object.assign(options, { url })
  }

  async test(){
    if(!(depsArePassing()))
      this.log(`warn`, `NIP-${getNipKey(this.nip)}: Dependencies are not passing. Skipping test`)
    this.data = await this.run()
    await this.validate()
    await this.finish()
    return this.result()
  }

  setDeps(){
    this.deps = (NipDeps?.[this.nip] instanceof Array)? NipDeps[this.nip]: [1]
  }

  depsArePassing(){
    return this.deps.every( dep => !this.failing.includes(dep) && this.passing.includes(dep) )
  }

  async finish(){
    this.cleanUp()
    if(this.opts.closeRelay)
      this.$relay.close()
    if(this.pass)
      this.passing.push(this.nip)
    else  
      this.failing.push(this.nip)
  }

  async run(){
    //override this.
    this.data = await this.get()
  }

  async get(){
    return 'hello world'
  }

  async validate(){
    //override this
  }

  async validateSchema(schema, event){
    const validator = this.opts.validator instanceof Function ? this.opts.validator(schema) : ajv.compile(schema)
    return validator(event)
  }

  log(type, message){
    this.logData.push([type, message])
  }

  result(){
    return {
      url: this.url,
      pass: this.pass,
      testing: this.testing,
      passing: this.passing,
      failing: this.failing,
      log: this.logData,
      data: this.data,
      $relay: this.$relay,
    }
  }
}