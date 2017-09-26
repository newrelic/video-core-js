import Emitter from './emitter'

/**
 * Tracker class provides the basic logic to extend Newrelic's Browser Agent capabilities.
 * Trackers are designed to listen third party elements (like video tags, banners, etc.) and send
 * information over to Browser Agent. Extend this class to create your own tracker, override
 * registerListeners and unregisterListeners for full coverage!
 *
 * @example
 * Tracker instances should be added to Core library to start sending data:
 * nrvideo.Core.addTracker(new Tracker())
 *
 * @extends Emitter
 */
class Tracker extends Emitter {
  /**
   * Constructor, receives options.
   * Lifecycle goes like this: constructor > {@link setOptions} > {@link registerListeners}.
   *
   * @param {Object} [options] Options for the tracker. See {@link setOptions}.
   */
  constructor (options) {
    super()

    /**
     * If you add something to this custom dictionary it will be added to every action. If you set
     * any value, it will always override the values returned by the getters.
     *
     * @example
     * If you define tracker.customData.contentTitle = 'a' and tracker.getTitle() returns 'b'.
     * 'a' will prevail.
     */
    this.customData = {}

    options = options || {}
    this.setOptions(options)
  }

  /**
   * Set options for the Tracker.
   *
   * @param {Object} [options] Options for the tracker.
   * @param {Object} [options.customData] Set custom data. See {@link customData}.
   */
  setOptions (options) {
    if (options) {
      if (options.customData) this.customData = options.customData
    }
  }

  /**
   * Prepares tracker to dispose. Calls {@see unregisterListeners} and drops references.
   */
  dispose () {
    this.unregisterListeners()
  }

  /**
   * Override this method to register listeners to third party elements.
   *
   * @example
   * class SpecificTracker extends Tracker {
   *  registerListeners() {
   *    this.player.on('play', () => this.playHandler)
   *  }
   *
   *  playHandler() {
   *    this.emit(Tracker.Events.REQUESTED)
   *  }
   * }
   */
  registerListeners () {}

  /**
   * Override this method to unregister listeners to third party elements created with
   * {@see registerListeners}.
   *
   * @example
   * class SpecificTracker extends Tracker {
   *  registerListeners() {
   *    this.player.on('play', () => this.playHandler)
   *  }
   *
   *  unregisterListeners() {
   *    this.player.off('play', () => this.playHandler)
   *  }
   *
   *  playHandler() {
   *    this.emit(Tracker.Events.REQUESTED)
   *  }
   * }
   */
  unregisterListeners () {}

  /**
   * Override this method to return attributes for actions.
   *
   * @example
   * class SpecificTracker extends Tracker {
   *  getAttributes(att) {
   *    att = att || {}
   *    att.information = 'something'
   *    return att
   *  }
   * }
   *
   * @param {object} [att] Collection of key value attributes
   * @return {object} Filled attributes
   * @final
   */
  getAttributes (att) {
    return att || {}
  }

  /**
   * Send given event. Will automatically call {@see getAttributes} to fill information.
   * Internally, this will call {@see Emitter#emit}, so you could listen any event fired.
   *
   * @example
   * tracker.send('BANNER_CLICK', { url: 'http....' })
   *
   * @param {string} event Event name
   * @param {object} [att] Key:value dictionary filled with attributes.
   */
  send (event, att) {
    this.emit(event, this.getAttributes(att))
  }
}

export default Tracker
