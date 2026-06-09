/**
 * Time-weighted average accumulator.
 *
 * Models a stream of (value, timestamp) observations and produces a running
 * average where each observed value is weighted by the time it remained the
 * most-recent observation. The `isPlaying` gate excludes pause/buffer/seek time.
 *
 * Min/max update from raw observations regardless of play state.
 *
 * Extracted from the original `trackContentBitrateState` (videotrackerstate.js:702-758).
 */
export class WeightedAverage {
  constructor() {
    this.reset();
  }

  reset() {
    this._lastValue = null;
    this._lastChangeTimestamp = null;
    this._partialSum = 0;
    this._totalDuration = 0;
    this.weighted = 0;
    this.min = null;
    this.max = null;
  }

  hasObservations() {
    return this.min !== null;
  }

  observe(value, isPlaying) {
    if (!value || typeof value !== "number" || value <= 0) return;

    this.min = this.min === null ? value : Math.min(this.min, value);
    this.max = this.max === null ? value : Math.max(this.max, value);

    const now = Date.now();

    if (!isPlaying) {
      this._closeSegment(now);
      this._lastChangeTimestamp = null;
      this._lastValue = value;
      return;
    }

    if (this._lastChangeTimestamp === null && this._lastValue !== null) {
      this._lastChangeTimestamp = now;
    }

    if (this._lastValue !== null
        && this._lastValue !== value
        && this._lastChangeTimestamp !== null) {
      this._closeSegment(now);
      this._lastChangeTimestamp = now;
    }

    if (this._lastChangeTimestamp === null) {
      this._lastChangeTimestamp = now;
    }
    this._lastValue = value;

    let totalWeighted = this._partialSum;
    let totalDuration = this._totalDuration;
    const currentSegment = now - this._lastChangeTimestamp;
    if (currentSegment > 0) {
      totalWeighted += value * currentSegment;
      totalDuration += currentSegment;
    }
    this.weighted = totalDuration > 0
        ? Math.round(totalWeighted / totalDuration)
        : value;
  }

  _closeSegment(now) {
    if (this._lastValue !== null && this._lastChangeTimestamp !== null) {
      const dur = now - this._lastChangeTimestamp;
      if (dur > 0) {
        this._partialSum += this._lastValue * dur;
        this._totalDuration += dur;
      }
    }
  }
}

export default WeightedAverage;
