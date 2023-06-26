
export const getNip11 = async function(relay, cbs){
  const url = new URL(relay),
          headers = {
            "Accept": "application/nostr+json",
          }
  return new Promise( async (resolve) => {
    const timeout = setTimeout( () => { 
      cbs?.onTimeout()
      // this.log(`timeout`, `NIP-11: info document was not returned within 10000 milliseconds`) //need to add timeout opt for info.
      resolve( {} ) 
    }, 10*1000 )
    const _res = fetch(`https://${url.hostname}/`, { method: 'GET', headers })
      .then(async response => { 
        try {
          let res = await response.json()
          cbs?.onSuccess()
          // this.log(`success`, `NIP-11: info document was fetched and parsed in ${this.result.latency.nip11}ms`) //need to add timeout opt for info.
          return res 
        } catch (err) {
          cbs?.onError('errorJsonParse')
          // this.log('error', 'Could not parse NIP-11 information document')
          return { error: err }
        } 
      })
      .catch(err => {
        console.error(`${relay}`, err) //could pass this error to log
        cbs?.onError('errorFetch')
        // this.log('error', 'Host returned an error when attempting to fetch NIP-11 info document')
        return false
      });
    clearTimeout(timeout) 
    resolve( await _res )
  })
}