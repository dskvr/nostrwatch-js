import {generatePrivateKey, getPublicKey, getEventHash, signEvent} from 'nostr-tools'
import crypto from 'crypto'

export const getAverageLatency = function(latencies){
  // if(!latencies?.length)
  //   return null
  return Math.round(latencies?.filter(l => l || l?.length).reduce((a, b) => a + b) / latencies.length);
}  

export const getMedianLatency = function(latencies){
  // if(!latencies?.length)
  //   return null
  const mid = Math.floor(latencies.length / 2),
    nums = [...latencies].sort((a, b) => a - b);
  return latencies.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

export const getMinLatency = function(latencies){
  // if(!latencies?.length)
  //   return null
  return Math.min(...latencies)
}

export const getMaxLatency = function(latencies){
  // if(!latencies?.length)
  //   return null
  return Math.max(...latencies)
}

export const generateRandomKeypair = function(){
  let sk = generatePrivateKey() // `sk` is a hex string
  let pk = getPublicKey(sk) // `pk` is a hex string
  return [sk, pk]
}

export const getNipKey = function(nip){
  nip = toString(nip)
  return nip.length > 1 ? nip : `0${nip}`
}

export const signRandomEvent = function(sk, pk){
  const event = {
    created_at: Math.round(Date.now()/1000),
    kind: 1,
    content: crypto.randomBytes(getRandomInt(10,120)).toString('hex'),
    tags: [],
    pubkey: pk
  }

  event.id = getEventHash(event)
  event.sig = signEvent(event, sk)

  return event
}

export const signNip09 = function(sk, pk, id){
  const event = {
    created_at: Math.round(Date.now()/1000),
    kind: 5,
    content: '',
    tags: [ 
      ['e', id]
    ],
    pubkey: pk
  }

  event.id = getEventHash(event)
  event.sig = signEvent(event, sk)

  return event
}


export const getRandomInt = function(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const hashString = function(str) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
      let chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

export const uuid = function(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}