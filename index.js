/* eslint-disable */
import RelayChecker from './src/checker.js'
import QueuedChecker from './src/queue.js'
import {Result as RelayCheckerResult, Opts as RelayCheckerOpts, Timeout as RelayCheckerTimeout} from './src/types.js'
import { getAverageLatency, getMedianLatency, getMinLatency, getMaxLatency } from './src/utils.js'

export {
  //Relay Checker
  RelayChecker,

  //Types
  RelayCheckerResult,
  RelayCheckerOpts,
  RelayCheckerTimeout,

  //Queue 
  QueuedChecker,

  //Utils
  getAverageLatency,
  getMedianLatency,
  getMinLatency,
  getMaxLatency
}
