/* eslint-disable */
import RelayChecker from './src/checker.js'
import {Result as RelayCheckerResult, Opts as RelayCheckerOpts, Timeout as RelayCheckerTimeout} from './src/types.js'
import { getAverageLatency, getMedianLatency, getMinLatency, getMaxLatency } from './src/utils.js'

export {
  RelayChecker,
  RelayCheckerResult,
  RelayCheckerOpts,
  RelayCheckerTimeout,

  getAverageLatency,
  getMedianLatency,
  getMinLatency,
  getMaxLatency
}
