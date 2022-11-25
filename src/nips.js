//https://github.com/fiatjaf/nostr-tools/blob/master/nip05.js
import fetch from 'cross-fetch'

const nips = new Array(99).fill({ type: 'object' })

//nip-05
nips[5].test = async function(domain, query = '') {
  const url = new URL(domain)
  let res = await fetch(`https://${url.hostname}/.well-known/nostr.json?name=${query}`)
                    .then(response => response.json())
                    .catch(err => console.log(err));
  return res && Object.prototype.hasOwnProperty.call(res, 'names') ? res.names : []
}


//nip-11
nips[11].test = async function(url){
  try {
    let [name, url] = fullname.split('@')
    if (!url) return null

    const headers = { Accept: "appliation/nostr+json" }

    let res = await (
      await fetch(`https://${domain}/.well-known/nostr.json?name=${name}`, { method: 'get', headers: headers})
    ).json()

    return res
  } catch (_) {
    return null
  }
}

export default nips
