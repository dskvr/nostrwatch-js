//https://github.com/fiatjaf/nostr-tools/blob/master/nip05.js
import fetch from 'cross-fetch'

async function searchDomain(domain, query = '') {
  const url = new URL(domain)

  let res = await fetch(`https://${url.hostname}/.well-known/nostr.json?name=${query}`)
                    .then(response => response.json())
                    .catch(err => console.log(err));
  return res && Object.prototype.hasOwnProperty.call(res, 'names') ? res.names : []
}

async function queryName(fullname) {
  try {
    let [name, domain] = fullname.split('@')
    if (!domain) return null

    let res = await (
      await fetch(`https://${domain}/.well-known/nostr.json?name=${name}`)
    ).json()

    return res.names && res.names[name]
  } catch (_) {
    return null
  }
}

const nip05 = {
  searchDomain,
  queryName
}

export {
  nip05
}
