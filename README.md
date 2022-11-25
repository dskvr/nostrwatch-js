# nostr-relay-inspector
Library for inspecting nostr relays. **Work in progress**, drastic changes such as name change, are very likely. 

## Install
_Not yet published to npm, will be published once beta_ 

## Usage
Constructor accepts websocket reference or nostr-js Relay object. 

```
import { Inspector } from '../path/to/nostr-relay-inspector` 
import { Relay } from 'nostr' //optional!

let inspect;

//pass websocket  
inspect = new Inspector('wss://nostr.sandwich.farm');

//or pass a nostr-js Relay instance 
const relay = new Relay('wss://nostr.sandwich.farm');
//do some things with the relay
inspect = new Inspector(relay);

inspect.run();

inspect
  .on('open', (e, result) => {
    console.log('unprocessed', result);
  })
  .on('complete', (e, result) => {
    console.log('processed relay', result);
  })
```

## Todo 
- [x] Alpha release
- [ ] Return collated result object, requires minor refactor 
- [ ] Clean up the namespace  
- [ ] Write tests 
- [ ] Docs 
