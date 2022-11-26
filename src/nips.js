import settings from '../settings.yml'
import fetch from 'cross-fetch'

const NipTest = {
  type: Object, //Object (object/array) or Boolean
  test: ( nip ) => { return } //for success return respective of 'type', and false for fail.
}

const nips = new Array(settings.nipsTotal+1).fill(NipTest);

//nip-05 ... https://github.com/fiatjaf/nostr-tools/blob/master/nip05.js
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
