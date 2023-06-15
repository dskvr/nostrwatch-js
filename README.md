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

let $checker;

//pass websocket URL 
$checker = new RelayChecker('wss://relay.nostr.band');

$checker
  .on('change', (result) => {
    console.log('something updated', result);
  })
  .on('complete', (self) => {
    console.log('processed result', self.result);
  })
```
