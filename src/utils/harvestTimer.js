import Log from "../log";

/**
 * Periodic harvest timer using chained `setTimeout`. Each tick schedules the
 * next one only after the current `onTick` callback resolves — by construction
 * there can never be overlapping ticks, even if `onTick` is async and slow.
 *
 * Used by both pipelines:
 *   - `browser/harvestScheduler.js` — Browser pipeline drain orchestration
 *   - `connectedDevice/connectedDeviceHarvester.js` — Vega CAF pipeline
 *
 * Single source of truth for harvest timing. Future timer changes (drift
 * compensation, jitter, exponential back-off, etc.) land here and apply to
 * both pipelines automatically.
 *
 * @param {object} opts
 * @param {number} opts.interval - Initial tick interval in ms.
 * @param {() => Promise<void>|void} opts.onTick - Pipeline-specific drain
 *   callback. Awaited; the next tick is scheduled in `finally` so a slow or
 *   throwing tick can't overlap with the next one.
 * @param {string} opts.errorLabel - Prefix for the error log when `onTick`
 *   throws (e.g. "HarvestScheduler", "ConnectedDeviceHarvester").
 *
 * @returns {{
 *   start: () => void,
 *   stop: () => void,
 *   cancelAndReschedule: () => void,
 *   updateInterval: (ms: number) => void,
 *   isRunning: () => boolean,
 * }}
 */
export function createHarvestTimer({ interval, onTick, errorLabel }) {
  let isStarted = false;
  let currentTimerId = null;
  let currentInterval = interval;

  function scheduleNext() {
    if (!isStarted) return;
    currentTimerId = setTimeout(async () => {
      currentTimerId = null;
      try {
        await onTick();
      } catch (error) {
        Log.error(`${errorLabel}: scheduled tick failed:`, error.message);
      } finally {
        if (isStarted) scheduleNext();
      }
    }, currentInterval);
  }

  return {
    /**
     * Start the timer. Idempotent — repeated calls have no effect while
     * already running.
     */
    start() {
      if (isStarted) return;
      isStarted = true;
      scheduleNext();
    },

    /**
     * Stop the timer. The pending tick (if any) is cancelled. The currently-
     * executing tick (if any) will see `isStarted === false` in its `finally`
     * and won't schedule a successor.
     */
    stop() {
      isStarted = false;
      if (currentTimerId) {
        clearTimeout(currentTimerId);
        currentTimerId = null;
      }
    },

    /**
     * Cancel any pending tick and reschedule from now. Used by smart-harvest /
     * forceHarvest paths that drain the buffer immediately and want the
     * periodic clock reset relative to that drain.
     */
    cancelAndReschedule() {
      if (currentTimerId) {
        clearTimeout(currentTimerId);
        currentTimerId = null;
      }
      if (isStarted) scheduleNext();
    },

    /**
     * Update the tick interval. Takes effect on the next scheduled tick.
     * If the timer is currently running, the pending tick is cancelled and
     * a new one is scheduled with the new interval.
     *
     * @param {number} ms - New interval in milliseconds. Must be a positive
     *   number; invalid values are silently ignored.
     */
    updateInterval(ms) {
      if (typeof ms !== "number" || ms <= 0) return;
      currentInterval = ms;
      if (isStarted && currentTimerId) {
        clearTimeout(currentTimerId);
        currentTimerId = null;
        scheduleNext();
      }
    },

    /** @returns {boolean} True iff `start()` has been called and `stop()` has not. */
    isRunning: () => isStarted,
  };
}
