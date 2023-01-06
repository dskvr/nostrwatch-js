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
checkRelay(relay){
  let inspect = new Inspector(relay)
  inspect
    .on('complete', inspector => {
      if( inspector.result instanceof Object)
        doSomething(inspector.result)
      else 
        doSomething({})
    })
    .on('error', inspector => doSomething(inspector.result, true))
    .run()
    .catch( console.error )  
}

doSomething(result, error){
  if(!error)
    alert(`${relay.url} - Connect?: ${relay.check.connect ? 'yes' : 'no'}, Read?: ${relay.check.read ? 'yes' : 'no'}, Write?: ${relay.check.write ? 'yes' : 'no'}`
  else
    alert(`there was an error on ${result.url}`)
}

checkRelay('wss://nostr.damus.io')
```

## Todo
- [x] Alpha release
- [ ] Return collated result object, requires minor refactor
- [ ] Clean up the namespace  
- [ ] Write tests
- [ ] Docs
