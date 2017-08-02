import { Log } from './log'

/**
 * Static class that sums up core functionalities of the library.
 */
const core = {
  /**
   * Add a tracker to the system. Trackers added will start reporting its events to NR's backend.
   * @param {Tracker} tracker 
   */
  addTracker: function (tracker) {
    if (tracker.getTrackerName) {
      tracker.on('*', eventHandler)
      tracker.emit('TRACKER_READY', tracker.getAttributes())
    } else {
      Log.error('Tried to load a non-tracker.', tracker)
    }
  },

  /**
   * Disposes and remove given tracker. Removes its listeners.
   * 
   * @param {Tracker} tracker Tracker to remove.
   */
  removeTracker: function (tracker) {
    tracker.off('*', eventHandler)
    tracker.dispose()
    let index = trackers.indexOf(tracker)
    if (index !== -1) trackers.splice(index, 1)
  },

  /**
   * Returns the array of trackers.
   * 
   * @returns {Tracker[]} Array of trackers.
   */
  getTrackers: function () {
    return trackers
  },

  /**
   * Sends given event. Uses newrelic Browser Agent.
   * @param {String} event Event to send.
   * @param {Object} data Data associated to the event.
   */
  send: function (event, data) {
    if (typeof newrelic !== 'undefined' && newrelic.addPageAction) {
      cleanData(data)
      newrelic.addPageAction(event, data)
    } else {
      if (!isErrorShown) {
        Log.error(
          'newrelic.addPageAction() is not available.',
          'In order to use NewRelic Video you will need New Relic Browser Agent.'
        )
        isErrorShown = true
      }
    }
  }
}

let trackers = []
let isErrorShown = false

/**
 * Logs and sends given event.
 *
 * @private
 * @param {Event} e Event
 */
function eventHandler (e) {
  Log.notice(e.type)
  core.send(e.type, e.data)
}

/**
 * Cleans given object, removing all items with value === null.
 * @private
 * @param {Object} data Data to clean
 * @returns {Object} Cleaned object
 */
function cleanData (data) {
  let ret = {}
  for (let i in data) {
    if (data[i] !== null) ret[i] = data[i]
  }
  return ret
}

export default core
