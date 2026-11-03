import Log from "./log";

const INFO_RATIO = 0.85;
const WARNING_RATIO = 0.9;

/**
 * Logging-only capacity/drop reporter for one buffer. Gated by `enableLogging`,
 * which also sets `Log.level`, so output is filtered like any other agent log.
 * Holds the buffer's cumulative drop count and the once-per-crossing latches.
 */
export class BufferDropLogger {
  private dropped = 0;
  private infoLatched = false;
  private warningLatched = false;

  constructor(private readonly name: string) {}

  /** Lets callers skip computing fill when logging is off. */
  isEnabled(): boolean {
    return Log.isEnabled();
  }

  /**
   * Call whenever the buffer's fill changes. Logs INFO at 85% and WARNING at
   * 90% once per crossing; falling back under a threshold re-arms it.
   * @param ratio Fill ratio (0-1), from whichever limit is closer to full
   */
  update(ratio: number, count: number, capacity: number): void {
    if (ratio < INFO_RATIO) this.infoLatched = false;
    if (ratio < WARNING_RATIO) this.warningLatched = false;

    if (ratio >= WARNING_RATIO && !this.warningLatched) {
      this.warningLatched = true;
      this.infoLatched = true;
      Log.ifEnabled("warn", `${this.name} buffer 90% full (${count} of ${capacity} events)`);
    } else if (ratio >= INFO_RATIO && ratio < WARNING_RATIO && !this.infoLatched) {
      this.infoLatched = true;
      Log.ifEnabled("notice", `${this.name} buffer 85% full (${count} of ${capacity} events)`);
    }
  }

  /** Call on every eviction. Never rate limited; the count never resets. */
  drop(capacity: number): void {
    this.dropped++;
    Log.ifEnabled(
      "error",
      `${this.name} buffer full (capacity ${capacity}), oldest event dropped. Total dropped this session: ${this.dropped}`
    );
  }
}
