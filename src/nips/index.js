import { getNipKey } from '../utils.js'

import {default as Nip09} from './nip-09.js'
import {default as Nip11} from './nip-11.js'

const CLASS_MAP = {
  9: Nip09,
  11: Nip11,
}

export const Nip = CLASS_MAP

export const validateSupportedNips = async function(url){
  const nip11 = new Nip11(url)
  await nip11.test()
  if(!nip11.pass)
    return "NIP-11 is required"
  if(nip11?.data?.supported_nips)
    return validateNips(nip11.data.supported_nips, nip11.$relay, {passing: nip11?.passing, failing: nip11?.failing, supported: nip11.data.supported_nips})
}

export const validateNips = async function(arr, $relay, options){
  const result = new Object()
  let supported = options?.supported || null,
      testing = options?.testing || null,
      passing = options?.passing || null,
      failing = options?.failing || null
  
  for(let i=0; i<arr.length; i++){
    const nipint = arr[i]
    const CLASS = CLASS_MAP[nipint]
    const datakey = nipint
    try{
      const options = { testing, passing, failing, $relay }
      const nipcheck = new CLASS($relay.url, options)
      result[datakey] = await nipcheck.test()
      testing = result[datakey].testing
      passing = result[datakey].passing
      failing = result[datakey].failing      
    }
    catch(e){ 
      console.warn(`nip-${key} test is not yet implemented.`) 
    }
  }
  console.dir(result)
  return result
}