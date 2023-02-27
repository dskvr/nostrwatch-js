# nostrwatch-js
Library for inspecting nostr relays. 

## Install
### npm
`npm install nostrwatch-js`

### yarn
`yarn add nostrwatch-js`

## Usage

```
import { Inspector } from 'nostrwatch-js` 

let inspect;

//pass websocket URL 
inspect = new Inspector('wss://nostr.sandwich.farm');

//...do some things with the relay
inspect = new Inspector(relay);

inspect
  .on('open', (e, result) => {
    console.log('unprocessed', result);
  })
  .on('complete', (e, self) => {
    console.log('processed relay', self.result);
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
