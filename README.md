# nostr-relay-inspector
Library for inspecting nostr relays. 

**Presently alpha, result objects and API are prone to change. Docs will be published shortly after beta**

## Install
### npm
`npm install nostr-relay-inspector`

### yarn
`yarn add nostr-relay-inspector`

## Usage

```
import { Inspector } from 'nostr-relay-inspector` 

let inspect;

//pass websocket reference 
inspect = new Inspector('wss://nostr.sandwich.farm');

//...do some things with the relay
inspect = new Inspector(relay);

inspect
  .on('open', (e, result) => {
    console.log('unprocessed', result);
  })
  .on('complete', (e, result) => {
    console.log('processed relay', result);
  })
  .run()
```

# Example
```
processRelays(){
  let inspect = new Inspector(relay)
  inspect
    .on('complete', inspector => {
      if( inspector.result instanceof Object)
        doSomething(inspector.result)
      else 
        doSomething({})
    })
    .on('error', inspector => {
      errored++
      doSomething({})
    })
    .run()
    .catch( console.error )  
}

doSomething(result){
  alert(`${relay.url}${}`${})${}

```

## Todo
- [x] Alpha release
- [ ] Return collated result object, requires minor refactor
- [ ] Clean up the namespace  
- [ ] Write tests
- [ ] Docs
