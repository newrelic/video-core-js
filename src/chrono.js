/**
 * This class calculates time lapses between two points on time.
 */
class Chrono {
  /**
   * Constructor
   */
  constructor () {
    this.reset()
  }

  /** Reset chrono values. */
  reset () {
    /** Start time */
    this.startTime = 0

    /** Stop time */
    this.stopTime = 0

    /**
     * If you set an offset in a chrono, its value will be added getDeltaTime and stop.
     *
     * @example
     * let chrono = new Chrono()
     * chrono.offset = 500
     * chrono.start()
     * process.sleep(500)
     * chrono.stop() // Will return 1000
     *
     * @type {number}
     */
    this.offset = 0
  }

  /**
   * Returns the time between start() and the last stop() in ms. Returns null if start wasn't
   * called.
   * @return {(number|null)} Time lapse in ms.
   */
  getDeltaTime () {
    if (this.startTime) {
      return this.offset + (new Date().getTime() - this.startTime)
    } else {
      return null
    }
  }

  /**
   * Starts the chrono.
   */
  start () {
    this.startTime = new Date().getTime()
    this.stopTime = 0
  }

  /**
   * Stops the timer and returns delta time.
   * @return {(number|null)} Returns the delta time
   */
  stop () {
    this.stopTime = new Date().getTime()
    return this.getDeltaTime()
  }

  /**
   * Creates a copy of the chrono.
   * @returns {Chrono} Cloned chrono
   */
  clone () {
    var chrono = new Chrono()
    chrono.startTime = this.startTime
    chrono.stopTime = this.stopTime
    chrono.offset = this.offset
    return chrono
  }
}

export default Chrono
