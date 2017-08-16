/**
 * This base class implements a basic behavior of listeners and events. Extend this object to have
 * this feature built-in inside your classes.
 *
 * @class Emitter
 */
class Emitter {
  /**
   * Sets a listener to a given event. Use {@link emit} to trigger those events.
   * Pass '*' to listen ALL events.
   *
   * @param {string} event Name of the event.
   * @param {function} callback Callback of the event. Receives event and data.
   * @return this
   */
  on (event, callback) {
    this._listeners = this._listeners || {}
    if (typeof callback === 'function') {
      this._listeners[event] = this._listeners[event] || []
      this._listeners[event].push(callback)
      return this
    }
  }

  /**
   * Removes given callback from the listeners of this object.
   *
   * @param {string} event Name of the event.
   * @param {function} callback Callback of the event.
   * @return this
   */
  off (event, callback) {
    this._listeners = this._listeners || {}

    if (this._listeners[event]) {
      var index = this._listeners[event].indexOf(callback)
      if (index !== -1) {
        this._listeners[event].splice(index, 1)
      }
    }
    return this
  }

  /**
   * Emits given event, triggering all the associated callbacks.
   *
   * @param {string} event Name of the event.
   * @param {object} [data] Custom data to be sent to the callbacks.
   * @return this
   */
  emit (event, data) {
    this._listeners = this._listeners || {}
    data = data || {}

    if (Array.isArray(this._listeners[event])) {
      this._listeners[event].forEach((callback) => {
        callback.call(this, { type: event, data: data, target: this })
      })
    }

    if (Array.isArray(this._listeners['*'])) {
      this._listeners['*'].forEach((callback) => {
        callback.call(this, { type: event, data: data, target: this })
      })
    }

    return this
  }
}

export default Emitter
