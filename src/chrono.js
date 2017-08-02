/**
 * This class calculates time lapses between two points on time.
 *
 * @memberof nrvideo
 */
export default class Chrono {
  /** Constructor */
  constructor () {
    this.reset()
  }

  /** Reset chrono values. */
  reset () {
    /** Start time */
    this.startTime = 0

    /** Stop time */
    this.stopTime = 0

    /** Offset to be added to deltaTime and stop. in ms. */
    this.offset = 0
  }

  /**
   * Returns the time between start() and the last stop() in ms. Returns -1 if start wasn't
   * called.
   * @return {number} Time lapse in ms.
   */
  getDeltaTime () {
    if (this.startTime) {
      return this.offset + (new Date().getTime() - this.startTime)
    } else {
      return -1
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
   * @return {number} Returns the delta time
   */
  stop () {
    this.stopTime = new Date().getTime()
    return this.getDeltaTime()
  }

  /**
   * Creates a copy of the chrono.
   */
  clone () {
    var chrono = new Chrono()
    chrono.startTime = this.startTime
    chrono.stopTime = this.stopTime
    chrono.offset = this.offset
    return chrono
  }
}
