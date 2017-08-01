import { Log } from './log'

let trackers = []

/**
 * Add a trackerto the system. Trackers added will start reporting its events to NR's backend.
 * @param {Tracker} tracker 
 */
export function addTracker (tracker) {
  if (tracker.getTrackerName) {
    tracker.on('*', eventHandler)
    tracker.emit('TRACKER_READY', tracker.getAttributes())
  } else {
    Log.error('Tried to load a non-tracker.', tracker)
  }
}

/**
 * Disposes and remove given tracker. Removes its listeners.
 * 
 * @param {Tracker} tracker Tracker to remove.
 */
export function removeTracker (tracker) {
  tracker.off('*', eventHandler)
  tracker.dispose()
  let index = trackers.indexOf(tracker)
  if (index !== -1) trackers.splice(index, 1)
}

/**
 * Returns the array of trackers.
 * 
 * @returns {Tracker[]} Array of trackers.
 */
export function getTrackers () {
  return trackers
}

/**
 * Logs and sends given event.
 *
 * @private
 * @param {Event} e Event
 */
function eventHandler (e) {
  Log.notice(e.type)
  send(e.type, e.data)
}

let isErrorShown = false
/**
 * Sends given event. Uses newrelic Browser Agent.
 * @param {String} event Event to send.
 * @param {Object} data Data associated to the event.
 */
export function send (event, data) {
  if (newrelic && newrelic.addPageAction) {
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
