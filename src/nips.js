import config from '../config.yml'
import fetch from 'cross-fetch'

const NipTest = {
  type: Object, //Object (object/array) or Boolean
  test: ( nip ) => { return } //for success return respective of 'type', and false for fail.
}

const nips = new Object();

//nip-05 ... https://github.com/fiatjaf/nostr-tools/blob/master/nip05.js
nips['5']      = structuredClone(NipTest)
nips['5'].test =

//nip-11
nips['11']      = structuredClone(NipTest)
nips['11'].test = async function(domain){

  const url = new URL(domain),
        headers = {
          "Accept": "application/nostr+json",
        }

  console.log(`https://${url.hostname}/`, 'check_nip_11')

  let res = await fetch(`https://${url.hostname}/`, { method: 'GET', headers: headers})
                    .then(response => {
                      try { JSON.parse(JSON.stringify(response)) } catch (e) { return false; }
                      return response.json()
                    })
                    .catch(err => console.log(err))
  return res ? res : false
}

console.log(nips)

export default nips
