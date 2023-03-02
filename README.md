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

checker
  .on('open', (e, result) => {
    console.log('unprocessed result', result);
  })
  .on('complete', (e, self) => {
    console.log('processed result', self.result);
  })
```
