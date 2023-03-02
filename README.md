# nostrwatch-js
Library for inspecting nostr relays. 

## Install
### npm
`npm install nostrwatch-js`

### yarn
`yarn add nostrwatch-js`

## Usage

```
import { RelayChecker } from 'nostrwatch-js` 

let checker;

//pass websocket URL 
checker = new RelayChecker('wss://nostr.sandwich.farm');

//...do some things with the relay
checker = new RelayChecker(relay);

checker
  .on('open', (e, result) => {
    console.log('unprocessed result', result);
  })
  .on('complete', (e, self) => {
    console.log('processed result', self.result);
  })
```

## Todo
- [x] Alpha release
- [ ] Return collated result object, requires minor refactor
- [ ] Clean up the namespace  
- [ ] Write tests
- [ ] Docs
