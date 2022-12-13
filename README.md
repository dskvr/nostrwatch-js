# nostr-relay-inspector
Library for inspecting nostr relays. 

**Presently alpha, result objects and API are prone to change. Docs will be published shortly after beta**

## Install
### npm
`npm install nostr-relay-inspector`

### yarn
`yarn add nostr-relay-inspector`

## Usage
Constructor accepts websocket reference or nostr-js `Relay` instance.

```
import { Inspector } from 'nostr-relay-inspector` 
import { Relay } from 'nostr' //optional!

let inspect;

//pass websocket  
inspect = new Inspector('wss://nostr.sandwich.farm');

//or pass a nostr-js Relay instance
const relay = new Relay('wss://nostr.sandwich.farm');
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

## Todo
- [x] Alpha release
- [ ] Return collated result object, requires minor refactor
- [ ] Clean up the namespace  
- [ ] Write tests
- [ ] Docs
