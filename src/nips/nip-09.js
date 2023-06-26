import Nips from './nips.js'
import { generateRandomKeypair, signRandomEvent } from '../utils.js'

const NIP = 9
const DEPENDENCIES = [1]
const USE_RELAY_WRAPPER = false

export default class Nip09 extends Nips {
  constructor(url, options) {
    options = Object.assign(options, { useRelayWrapper: USE_RELAY_WRAPPER })
    super(NIP, url, options)

    this.deps = DEPENDENCIES

    this.testEvent = {}
    this.testEventPublished = false
    this.nip09EventPublished = false 
    this.testEventDeleted = false

    this.sk = ""
    this.pk = ""
  }

  async validate(){
    this.pass = this.testEventPublished && this.nip09EventPublished && this.testEventDeleted
    return this.pass
  }

  async run(){
    const url = this.url
    
    await this.publishTestEvent()
    if(!this.testEventPublished){
      this.log('warning', 'NIP-09: Could not publish test event')
      return this.result()
    }

    await this.publishNip09Event()
    if(!this.nip09EventPublished){
      this.log('warning', 'NIP-09: Could not publish NIP-09 event')
      return this.result()
    }
    
    await this.checkTestEvent()
    if(!this.testEventDeleted){
      this.log('warning', 'NIP-09: While NIP-09 event was published, the test event was not deleted')
      return this.result()
    }

    return this.result()
  }

  update(){
    this.data = {
      pubkey: this.pk,
      testEvent: this.testEvent,
      testEventPublished: this.testEventPublished,
      nip09Event: this.nip09Event,
      nip09EventPublished: this.nip09EventPublished,
      testEventDeleted: this.testEventDeleted
    }
  }

  async publishTestEvent(){
    return new Promise( resolve => {
      this
        .onRelay('open', Relay => {
          [this.sk, this.pk] = generateRandomKeypair()
          this.testEvent = signRandomEvent(sk, pk)
          this.update()
          this.sendEvent(JSON.stringify(this.testEvent))
          this.to = setTimeout( resolve, this.opts.timeout )
        })
        .onRelay('ok', () => {
          this.log('NIP-09: Kind 1 Test Event-for-deletion published successfully')
          this.testEventPublished = true
          this.update()
          this.cleanUp()
          clearTimeout(this.to)
          resolve()
        })
    })
  }

  async publishNip09Event(){
    return new Promise( resolve => {
      this.to = setTimeout( resolve, this.opts.timeout )
      this.nip09Event = signNip09(sk, pk, this.testEvent.id)
      this.update()
      this
        .onRelay('ok', () => {
          this.log('NIP-09: Kind 5 Event published successfully')
          this.nip09EventPublished = true
          this.update()
          this.cleanUp()
          clearTimeout(this.to)
          resolve()
        })
        .sendEvent(this.nip09Event)
    })
  }

  async checkTestEvent(){
    this.pass = await new Promise(resolve => {
      this.to = setTimeout( resolve, this.opts.timeout )
      this
        .onRelay('event', () => {
          clearTimeout(this.to)
          resolve(false)
        })
        .subscribe({ authors: [pk], kinds: [1] })
      const intval = setInterval( () => { 
        this.log('NIP-09: Kind 1 Test Event-for-deletion deleted successfully')
        this.testEventDeleted = true
        this.update()
        this.cleanUp()
        resolve(true)
      })
    })
    return this.pass
  }

  
}