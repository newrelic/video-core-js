import Log from './log'

/**
 * Static class that is used to record events. It supports multiple backends. The default one is the New Relic Browser Agent.
 * @static
 */

 class Recorder {

    /**
     * Sends given event using the appropriate backend.
     * @param {String} event Event to send.
     * @param {Object} data Data associated to the event.
     */
    static send(event, data) {
        if (Recorder.getBackend() == undefined) {
            // Use the default backend (NR Agent)
            if (typeof newrelic !== 'undefined' && newrelic.addPageAction) {
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
        else {
            // Use the user-defined backend
            Log.debug("TODO: use the user-defined backend")
        }
    }

    /**
     * Returns the current backend.
     *
     * @returns {Backend} The current backend.
     */
    static getBackend() {
        return backend
    }

    /**
     * Sets the current backend.
     * @param {Backend} backendInstance Backend instance.
     */
    static setBackend(backendInstance) {
        backend = backendInstance
    }
 }

 let backend;
 let isErrorShown = false
 
 export default Recorder
