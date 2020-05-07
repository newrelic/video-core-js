/**
 * Backend class provides the basic logic to create event backends.
 * This class is intended to be subclassed, not directly used.
 * 
 * @class Backend
 */
class Backend {

    constructor() {
        /**
         * Custom attributes
         * @private
         */
        this._attributes = {}
    }

    /**
     * Sends given event (to be overwritten by a subclass).
     * @param {String} event Event to send.
     * @param {Object} data Data associated to the event.
     */
    send(event, data) {
        data = Object.assign(data || {}, this._attributes)
    }

    /**
     * Store custom attribute.
     * @param {String} key Attribute name.
     * @param {Object} value Attribute value.
     */
    setAttribute(key, value) {
        this._attributes[key] = value
    }

    /**
     * Store custom attribute list.
     * @param {Object} attr Attributes.
     */
    setAttributes(attr) {
        this._attributes.append(attr)
    }
}

export default Backend