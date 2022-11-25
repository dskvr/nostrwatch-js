import settings from '../settings.yml'

//https://github.com/fiatjaf/nostr-tools/blob/master/nip05.js
import fetch from 'cross-fetch'

const nips = new Array(settings.nipsTotal+1).fill({ type: 'object', test: ()=>{} })
console.log(settings, nips)


//nip-05
nips[5].test = async function(domain, query = '') {
  const url = new URL(domain)
  let res = await fetch(`https://${url.hostname}/.well-known/nostr.json?name=${query}`)
                    .then(response => response.json())
                    .catch(err => console.log(err));
  return res && Object.prototype.hasOwnProperty.call(res, 'names') ? res.names : false
}

//nip-11
nips[11].test = async function(domain){
  const url = new URL(domain),
        headers = { Accept: "application/nostr+json" }

  let res = await fetch(`https://${domain}/`, { method: 'get', headers: headers})
                    .then(response => response.json())
                    .catch(err => console.log(err));
  return res ? res : false
}

export default nips
