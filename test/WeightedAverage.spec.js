import WeightedAverage from "../src/WeightedAverage.js";

describe("WeightedAverage", () => {
  let avg;
  let nowSpy;
  let currentTime;

  beforeEach(() => {
    avg = new WeightedAverage();
    currentTime = 1_000_000;
    nowSpy = jest.spyOn(Date, "now").mockImplementation(() => currentTime);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  const advance = (ms) => {
    currentTime += ms;
  };

  describe("initial state", () => {
    it("starts empty", () => {
      expect(avg.hasObservations()).toBe(false);
      expect(avg.weighted).toBe(0);
      expect(avg.min).toBeNull();
      expect(avg.max).toBeNull();
    });
  });

  describe("invalid inputs", () => {
    it("ignores zero", () => {
      avg.observe(0, true);
      expect(avg.hasObservations()).toBe(false);
      expect(avg.weighted).toBe(0);
    });

    it("ignores null", () => {
      avg.observe(null, true);
      expect(avg.hasObservations()).toBe(false);
    });

    it("ignores undefined", () => {
      avg.observe(undefined, true);
      expect(avg.hasObservations()).toBe(false);
    });

    it("ignores NaN", () => {
      avg.observe(NaN, true);
      expect(avg.hasObservations()).toBe(false);
    });

    it("ignores non-number", () => {
      avg.observe("1000", true);
      expect(avg.hasObservations()).toBe(false);
    });

    it("ignores negative (defensive)", () => {
      avg.observe(-100, true);
      expect(avg.hasObservations()).toBe(false);
    });
  });

  describe("single observation", () => {
    it("sets weighted=value, min=max=value", () => {
      avg.observe(1000, true);
      expect(avg.hasObservations()).toBe(true);
      expect(avg.weighted).toBe(1000);
      expect(avg.min).toBe(1000);
      expect(avg.max).toBe(1000);
    });
  });

  describe("time-weighted average (proves NOT arithmetic mean)", () => {
    it("10s @ 10Mbps then 600s @ 1Mbps weights toward 1Mbps, not 5.5Mbps", () => {
      avg.observe(10_000_000, true);
      advance(10_000); // 10s of 10Mbps
      avg.observe(1_000_000, true);
      advance(600_000); // 600s of 1Mbps
      avg.observe(1_000_000, true);

      // Σ(v×Δt) = 10e6×10000 + 1e6×600000 = 1e11 + 6e11 = 7e11
      // Σ(Δt) = 610000
      // weighted ≈ 1.1475e6
      expect(avg.weighted).toBeGreaterThanOrEqual(1_100_000);
      expect(avg.weighted).toBeLessThanOrEqual(1_200_000);
      // Definitely NOT the arithmetic mean of 5.5Mbps
      expect(avg.weighted).toBeLessThan(5_000_000);
    });

    it("min/max captured across the run", () => {
      avg.observe(10_000_000, true);
      advance(10_000);
      avg.observe(1_000_000, true);
      expect(avg.min).toBe(1_000_000);
      expect(avg.max).toBe(10_000_000);
    });
  });

  describe("non-playing gate", () => {
    it("excludes paused time from weighted average", () => {
      avg.observe(2_000_000, true);
      advance(1_000); // 1s playing @ 2Mbps
      avg.observe(2_000_000, false); // pause
      advance(60_000); // 60s paused (must NOT count)
      avg.observe(4_000_000, true); // resume at new bitrate
      advance(1_000); // 1s playing @ 4Mbps
      avg.observe(4_000_000, true);

      // Closed segment: 2Mbps × 1000ms (paused interval not counted)
      // In-progress: 4Mbps × 1000ms
      // weighted = (2e6×1000 + 4e6×1000) / 2000 = 3e6
      expect(avg.weighted).toBe(3_000_000);
    });

    it("min/max still capture during non-playing", () => {
      avg.observe(2_000_000, false);
      avg.observe(8_000_000, false);
      expect(avg.min).toBe(2_000_000);
      expect(avg.max).toBe(8_000_000);
    });

    it("does NOT update weighted on the non-playing path", () => {
      // First observation while not playing should leave weighted at its initial 0
      avg.observe(5_000_000, false);
      expect(avg.weighted).toBe(0);
    });
  });

  describe("multiple back-to-back changes", () => {
    it("attributes Δt to the OLD value before each change", () => {
      avg.observe(1_000_000, true);
      advance(2_000); // 2s @ 1Mbps
      avg.observe(2_000_000, true);
      advance(2_000); // 2s @ 2Mbps
      avg.observe(3_000_000, true);
      advance(2_000); // 2s @ 3Mbps
      avg.observe(3_000_000, true);

      // weighted = (1e6×2000 + 2e6×2000 + 3e6×2000) / 6000 = 2e6
      expect(avg.weighted).toBe(2_000_000);
    });

    it("two changes in the same millisecond produce zero-duration segments", () => {
      avg.observe(1_000_000, true);
      // No advance — same ms
      avg.observe(2_000_000, true);
      avg.observe(3_000_000, true);
      // All segments are 0ms; weighted falls back to current value
      expect(avg.weighted).toBe(3_000_000);
    });
  });

  describe("reset", () => {
    it("clears every field", () => {
      avg.observe(1_000_000, true);
      advance(5_000);
      avg.observe(2_000_000, true);

      avg.reset();

      expect(avg.hasObservations()).toBe(false);
      expect(avg.weighted).toBe(0);
      expect(avg.min).toBeNull();
      expect(avg.max).toBeNull();
      expect(avg._partialSum).toBe(0);
      expect(avg._totalDuration).toBe(0);
      expect(avg._lastValue).toBeNull();
      expect(avg._lastChangeTimestamp).toBeNull();
    });

    it("post-reset observations behave as fresh", () => {
      avg.observe(1_000_000, true);
      advance(5_000);
      avg.observe(2_000_000, true);
      avg.reset();

      avg.observe(500_000, true);
      expect(avg.weighted).toBe(500_000);
      expect(avg.min).toBe(500_000);
      expect(avg.max).toBe(500_000);
    });
  });

  describe("resume after pause", () => {
    it("restarts the segment timer cleanly", () => {
      avg.observe(2_000_000, true);
      advance(1_000); // 1s playing @ 2Mbps
      avg.observe(2_000_000, false); // pause closes segment
      advance(10_000); // paused — should not contribute
      avg.observe(2_000_000, true); // resume same bitrate
      advance(1_000); // 1s more
      avg.observe(2_000_000, true);

      // Total counted time = 2000ms all @ 2Mbps
      expect(avg.weighted).toBe(2_000_000);
    });
  });
});
