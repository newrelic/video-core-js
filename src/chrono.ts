/**
 * This class calculates time lapses between two points on time.
 */
class Chrono {
  /** Start time */
  startTime: number = 0;

  /** Stop time */
  stopTime: number = 0;

  /** accumulation of all the start and stop intervals */
  accumulator: number = 0;

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
  offset: number = 0;

  /**
   * Constructor
   */
  constructor() {
    this.reset();
  }

  /** Reset chrono values. */
  reset(): void {
    this.startTime = 0;
    this.stopTime = 0;
    this.accumulator = 0;
    this.offset = 0;
  }

  /**
   * Returns the time between start() and the last stop() in ms. Returns null if start wasn't
   * called.
   * @return {(number|null)} Time lapse in ms.
   */
  getDeltaTime(): number | null {
    if (this.startTime) {
      return this.offset + (new Date().getTime() - this.startTime);
    } else {
      return null;
    }
  }

  /**
   * Starts the chrono.
   */
  start(): void {
    this.startTime = new Date().getTime();
    this.stopTime = 0;
  }

  /**
   * Stops the timer and returns delta time.
   * @return {(number|null)} Returns the delta time
   */
  stop(): number | null {
    this.stopTime = new Date().getTime();
    if(this.startTime < this.stopTime) {
      this.accumulator += (this.stopTime - this.startTime);
    }
    return this.getDeltaTime();
  }

  getDuration(): number {
    if(this.stopTime) {
      return this.accumulator + this.offset;
    } else {
      return this.accumulator + (this.getDeltaTime() ?? 0)
    }
  }

  /**
   * Creates a copy of the chrono.
   * @returns {Chrono} Cloned chrono
   */
  clone(): Chrono {
    var chrono = new Chrono();
    chrono.startTime = this.startTime;
    chrono.stopTime = this.stopTime;
    chrono.offset = this.offset;
    chrono.accumulator = this.accumulator;
    return chrono;
  }
}

export default Chrono;
