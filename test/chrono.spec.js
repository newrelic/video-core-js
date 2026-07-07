import Chrono from "../src/chrono.js";

describe("Chrono", () => {
  let chrono;

  beforeEach(() => {
    chrono = new Chrono();
  });

  it("should start", () => {
    chrono.start();
    expect(chrono.startTime).toBeGreaterThan(0);
    expect(chrono.stopTime).toBe(0);
  });

  it("should stop and return time", () => {
    chrono.start();
    expect(chrono.stop()).toBeGreaterThan(-1);
    expect(chrono.getDeltaTime()).toBeGreaterThan(-1);
  });

  it("should not break if stop is called before start", () => {
    expect(chrono.stop()).toBeNull();
    expect(chrono.getDeltaTime()).toBeNull();
  });

  it("should work", (done) => {
    chrono.start();
    setTimeout(() => {
      const stopTime = chrono.stop();
      const deltaTime = chrono.getDeltaTime();

      // Allow for timer imprecision - expect ~100ms with 10ms tolerance
      expect(stopTime).toBeGreaterThanOrEqual(95);
      expect(stopTime).toBeLessThanOrEqual(110);
      expect(deltaTime).toBeGreaterThanOrEqual(95);
      expect(deltaTime).toBeLessThanOrEqual(110);
      done();
    }, 100);
  });

  it("should clone propperly", () => {
    chrono.start();
    chrono.stop();
    let chrono2 = chrono.clone();

    expect(chrono.startTime).toBe(chrono2.startTime);
    expect(chrono.stopTime).toBe(chrono2.stopTime);
    expect(chrono.offset).toBe(chrono2.offset);
    expect(chrono.accumulator).toBe(chrono2.accumulator);
  });

  it("should calculate duration when stopped", () => {
    chrono.start();
    chrono.stop();
    const duration = chrono.getDuration();
    expect(duration).toBeGreaterThan(-1);
  });

  it("should calculate duration while running", () => {
    chrono.start();
    const duration = chrono.getDuration();
    expect(duration).toBeGreaterThan(-1);
  });

  it("should calculate duration with offset when stopped", () => {
    chrono.offset = 100;
    chrono.start();
    chrono.stop();
    const duration = chrono.getDuration();
    expect(duration).toBeGreaterThanOrEqual(100);
  });

  it("should calculate duration with offset while running", () => {
    chrono.offset = 50;
    chrono.start();
    const duration = chrono.getDuration();
    expect(duration).toBeGreaterThanOrEqual(50);
  });

  it("should calculate duration when never started", () => {
    const duration = chrono.getDuration();
    expect(duration).toBe(0);
  });
});
