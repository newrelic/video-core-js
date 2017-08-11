import Core from './core'
import Constants from './constants'
import Log from './log'
import Emitter from './emitter'
import Tracker from './tracker'
import TrackerState from './trackerstate'

/**
 * New Relic Video namespace.
 */
module.exports = {
  /** @borrows nrvideo.Constants */
  Constants,
  /** @borrows nrvideo.Log */
  Log,
  /** @borrows nrvideo.Emitter */
  Emitter,
  /** @borrows nrvideo.Tracker */
  Tracker,
  /** @borrows nrvideo.TrackerState */
  TrackerState,
  /** @borrows nrvideo.Core */
  Core
}
