/**
 * Backend class provides the basic logic to create event backends.
 * This class is intended to be subclassed, not directly used.
 */

class Backend {

    /**
     * Sends given event (to be overwritten by a subclass).
     * @param {String} event Event to send.
     * @param {Object} data Data associated to the event.
     */
    send(event, data) {
        // The behaviour must be implemented in a subclass.
    }
}

export default Backend