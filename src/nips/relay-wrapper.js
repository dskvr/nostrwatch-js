import {Relay} from 'nostr'

export class RelayWrapper {
  constructor(relay){
    this.$relay = (relay instanceof Relay)? relay: new Relay(relay, {reconnect: false})
    this.handlerIds = ['event', 'ok', 'eose', 'notice', 'error', 'count']
    this.cleanUp()
  }

  sendEvent(event){
    this.$relay.send(['EVENT', event])
    return this
  }

  onRelay(handler, fn){
    if(!(fn instanceof Function))
      console.warn(`fn is not a function`)  
    this.$relay.on(handler, fn)
    return this
  }

  cleanUp(){
    this.handlerIds.forEach( handler => this.$relay.on(handler, ()=>{}) )
  }

  unsubscribe(){
    this.$relay.unsubscribe(this.subid)
  }

  subscribe(filters){
    this.$relay.subscribe(this.subid, filters)
  }
}