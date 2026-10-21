import Log from "./log";

export type DropLogLevel = "INFO" | "WARNING" | "ERROR";

const INFO_RATIO = 0.85;
const WARNING_RATIO = 0.9;

/**
 * Reads `enableLogging` from whichever pipeline config is active (browser
 * `window.NRVIDEO` or Vega `globalThis.__NRVIDEO_CD__`). Off unless `true` or
 * a level string; the minimum level itself is applied through `Log.level`.
 */
function isLoggingEnabled(): boolean {
  const cfg: any =
    (typeof window !== "undefined" ? window.NRVIDEO?.config : undefined) ??
    globalThis.__NRVIDEO_CD__?.config;
  const v = cfg?.enableLogging;
  return v === true || (typeof v === "string" && v !== "");
}

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
    return isLoggingEnabled();
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
      this.write("WARNING", `${this.name} buffer 90% full (${count} of ${capacity} events)`);
    } else if (ratio >= INFO_RATIO && ratio < WARNING_RATIO && !this.infoLatched) {
      this.infoLatched = true;
      this.write("INFO", `${this.name} buffer 85% full (${count} of ${capacity} events)`);
    }
  }

  /** Call on every eviction. Never rate limited; the count never resets. */
  drop(capacity: number): void {
    this.dropped++;
    this.write(
      "ERROR",
      `${this.name} buffer full (capacity ${capacity}), oldest event dropped. Total dropped this session: ${this.dropped}`
    );
  }

  private write(level: DropLogLevel, message: string): void {
    if (!isLoggingEnabled()) return;
    if (level === "ERROR") Log.error(message);
    else if (level === "WARNING") Log.warn(message);
    else Log.notice(message);
  }
}
