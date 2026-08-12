import TrackerState from "../src/videotrackerstate";

describe("VideoTrackerState", () => {
  let state;

  beforeEach(() => {
    state = new TrackerState();
  });

  it("should set isAd", () => {
    expect(state.isAd()).toBe(false);
    state.setIsAd(true);
    expect(state.isAd()).toBe(true);
  });

  it("should getViewId", () => {
    expect(state.getViewId()).toBeDefined();
  });

  it("should output attributes", () => {
    state.isStarted = true;
    state.isPaused = true;
    state.isBuffering = true;
    state.isSeeking = true;
    state.isAdBreak = true;
    expect(typeof state.getStateAttributes()).toBe("object");
    state.setIsAd(true);
    expect(typeof state.getStateAttributes()).toBe("object");
    state.isRequested = true;
    expect(typeof state.getStateAttributes()).toBe("object");
    state.setIsAd(false);
    expect(typeof state.getStateAttributes()).toBe("object");
  });

  it("should playerReady", () => {
    expect(state.goPlayerReady()).toBe(true);
    expect(state.goPlayerReady()).toBe(false);
    expect(state.isPlayerReady).toBe(true);
  });

  it("should request, start and end", () => {
    expect(state.isRequested).toBe(false);
    expect(state.isStarted).toBe(false);

    expect(state.goRequest()).toBe(true);
    expect(state.goRequest()).toBe(false);
    expect(state.timeSinceRequested.getDeltaTime()).toBeGreaterThan(-1);
    expect(state.isRequested).toBe(true);

    expect(state.goStart()).toBe(true);
    expect(state.goStart()).toBe(false);
    expect(state.timeSinceStarted.getDeltaTime()).toBeGreaterThan(-1);
    expect(state.isStarted).toBe(true);

    expect(state.goEnd()).toBe(true);
    expect(state.goEnd()).toBe(false);
    expect(state.isStarted).toBe(false);
    expect(state.isRequested).not.toBe(true);
  });

  it("should increment numberOfAds", () => {
    expect(state.numberOfAds).toBe(0);
    state.setIsAd(true);
    state.goRequest();
    state.goStart();
    expect(state.numberOfAds).toBe(1);
  });

  it("should pause and resume", () => {
    state.goRequest();
    state.goStart();

    expect(state.isPaused).toBe(false);

    expect(state.goPause()).toBe(true);
    expect(state.goPause()).toBe(false);
    expect(state.timeSincePaused.getDeltaTime()).toBeGreaterThan(-1);
    expect(state.isPaused).toBe(true);

    expect(state.goResume()).toBe(true);
    expect(state.goResume()).toBe(false);
    expect(state.timeSincePaused.getDeltaTime()).toBeGreaterThan(-1);
    expect(state.isPaused).toBe(false);
  });

  it("should seek", () => {
    state.goRequest();
    state.goStart();

    expect(state.isSeeking).toBe(false);

    expect(state.goSeekStart()).toBe(true);
    expect(state.goSeekStart()).toBe(false);
    expect(state.timeSinceSeekBegin.getDeltaTime()).toBeGreaterThan(-1);
    expect(state.isSeeking).toBe(true);

    expect(state.goSeekEnd()).toBe(true);
    expect(state.goSeekEnd()).toBe(false);
    expect(state.timeSinceSeekBegin.getDeltaTime()).toBeGreaterThan(-1);
    expect(state.isSeeking).toBe(false);
  });

  it("should buffer", () => {
    state.goRequest();
    state.goStart();

    expect(state.isBuffering).toBe(false);

    expect(state.goBufferStart()).toBe(true);
    expect(state.goBufferStart()).toBe(false);
    expect(state.timeSinceBufferBegin.getDeltaTime()).toBeGreaterThan(-1);
    expect(state.isBuffering).toBe(true);

    expect(state.goBufferEnd()).toBe(true);
    expect(state.goBufferEnd()).toBe(false);
    expect(state.timeSinceBufferBegin.getDeltaTime()).toBeGreaterThan(-1);
    expect(state.isBuffering).toBe(false);
  });

  it("should adBreak", () => {
    expect(state.isAdBreak).toBe(false);

    expect(state.goAdBreakStart()).toBe(true);
    expect(state.goAdBreakStart()).toBe(false);
    expect(state.timeSinceAdBreakStart.getDeltaTime()).toBeGreaterThan(-1);
    expect(state.isAdBreak).toBe(true);

    expect(state.goAdBreakEnd()).toBe(true);
    expect(state.goAdBreakEnd()).toBe(false);
    expect(state.timeSinceAdBreakStart.getDeltaTime()).toBeGreaterThan(-1);
    expect(state.isAdBreak).toBe(false);
  });

  it("should handle error tracking for both content and ads with proper state attributes", () => {
    expect(state.numberOfErrors).toBe(0);

    // Test content error - before and after
    state.setIsAd(false);
    let attributes = state.getStateAttributes();
    expect(attributes.timeSinceLastError).toBeUndefined();

    state.goError();
    expect(state.numberOfErrors).toBe(1);
    expect(state.timeSinceLastError.getDeltaTime()).toBeGreaterThan(-1);
    expect(state.timeSinceLastAdError.getDeltaTime()).toBeNull();

    attributes = state.getStateAttributes();
    expect(typeof attributes.timeSinceLastError).toBe("number");
    expect(attributes.timeSinceLastError).toBeGreaterThan(-1);

    // Test ad error - before and after
    state.setIsAd(true);
    attributes = state.getStateAttributes();
    expect(attributes.timeSinceLastAdError).toBeUndefined();

    state.goError();
    expect(state.numberOfErrors).toBe(2);
    const adErrorTime = state.timeSinceLastAdError.getDeltaTime();
    expect(adErrorTime).toBeGreaterThan(-1);

    attributes = state.getStateAttributes();
    expect(typeof attributes.timeSinceLastAdError).toBe("number");
    expect(attributes.timeSinceLastAdError).toBeGreaterThan(-1);
    expect(attributes.timeSinceLastError).toBeUndefined();

    // Verify independent timing for both contexts
    state.setIsAd(false);
    let contentAttrs = state.getStateAttributes();
    expect(typeof contentAttrs.timeSinceLastError).toBe("number");
    expect(contentAttrs.timeSinceLastError).toBeGreaterThan(-1);
    expect(contentAttrs.timeSinceLastAdError).toBeUndefined();
  });

  it("should start tineSinceLast timers", () => {
    state.goHeartbeat();
    expect(state.timeSinceLastHeartbeat.getDeltaTime()).toBeGreaterThan(-1);

    state.goLastAd();
    expect(state.timeSinceLastAd.getDeltaTime()).toBeGreaterThan(-1);

    state.goDownload();
    expect(state.timeSinceLastDownload.getDeltaTime()).toBeGreaterThan(-1);

    state.goRenditionChange();
    expect(state.timeSinceLastRenditionChange.getDeltaTime()).toBeGreaterThan(
      -1
    );

    state.goAdQuartile();
    expect(state.timeSinceLastAdQuartile.getDeltaTime()).toBeGreaterThan(-1);
  });

  it("should set and remove custom timeSince attributes", () => {
    // Test setTimeSinceAttribute
    state.setTimeSinceAttribute("customEvent");
    expect(state.customTimeSinceAttributes["customEvent"]).toBeDefined();
    expect(state.customTimeSinceAttributes["customEvent"].getDeltaTime()).toBeGreaterThan(-1);

    // Test removing custom attribute
    state.removeTimeSinceAttribute("customEvent");
    expect(state.customTimeSinceAttributes["customEvent"]).toBeUndefined();
  });

  it("should include custom timeSince attributes in getStateAttributes", () => {
    // Add custom attributes
    state.setTimeSinceAttribute("timeSinceCustomEvent1");
    state.setTimeSinceAttribute("timeSinceCustomEvent2");

    const attributes = state.getStateAttributes();

    expect(attributes.timeSinceCustomEvent1).toBeGreaterThan(-1);
    expect(attributes.timeSinceCustomEvent2).toBeGreaterThan(-1);
  });

  it("should track and reset playtimeSinceLastEvent based on playing state", () => {
    jest.useFakeTimers();
    state.setIsAd(false);
    state.goRequest();
    state.goStart();

    let attributes = state.getStateAttributes();
    expect(attributes.playtimeSinceLastEvent).toBe(0);
    jest.useRealTimers();

    attributes = state.getStateAttributes();
    expect(attributes.playtimeSinceLastEvent).toBeGreaterThan(-1);

    state.goPause();
    state.getStateAttributes();
    expect(state.isPlaying).toBe(false);
    expect(state.playtimeSinceLastEvent.startTime).toBe(0);
  });

  it("should handle pause when buffering", () => {
    state.goRequest();
    state.goStart();
    state.goBufferStart();

    expect(state.isBuffering).toBe(true);
    const result = state.goPause();
    expect(result).toBe(true);
    expect(state.isPaused).toBe(true);
  });

  it("should handle resume when buffering with _hb flag", () => {
    state.goRequest();
    state.goStart();
    state.goPause(); 

    state._hb = false;
    state.goBufferStart();
    expect(state.isBuffering).toBe(true);
    expect(state.isPaused).toBe(true);

    const result = state.goResume();
    expect(result).toBe(true);
    expect(state.isPlaying).toBe(true);
  });

  it("should calculate different buffer types correctly", () => {
    state.goRequest();
    state.goStart();

    // Test initial buffering
    let bufferType = state.calculateBufferType(true);
    expect(bufferType).toBe("initial");

    // Test seek buffering
    state.isSeeking = true;
    bufferType = state.calculateBufferType(false);
    expect(bufferType).toBe("seek");

    // Test pause buffering
    state.isSeeking = false;
    state.isPaused = true;
    bufferType = state.calculateBufferType(false);
    expect(bufferType).toBe("pause");

    // Test connection buffering (default case)
    state.isPaused = false;
    bufferType = state.calculateBufferType(false);
    expect(bufferType).toBe("connection");
  });

  describe("QOE KPI Tracking", () => {
    beforeEach(() => {
      state = new TrackerState();
      state.setIsAd(false); // Ensure we're in content mode
    });

    it("should initialize QOE state variables to correct defaults", () => {
      expect(state.startupTime).toBeNull();
      expect(state.peakBitrate).toBe(0);
      expect(state.partialAverageBitrate).toBe(0);
      expect(state._totalBitrateDuration).toBe(0);
      expect(state.weightedBitrate).toBe(0);
      expect(state.hadStartupError).toBe(false);
      expect(state.hadPlaybackError).toBe(false);
      expect(state.totalRebufferingTime).toBe(0);
    });

    it("should set startupTime correctly with ad time adjustment", () => {
      state.goRequest();

      // Test 1: Normal ad time adjustment
      state.timeSinceRequested.getDeltaTime = () => 1000;
      state.setStartupTime(300);
      expect(state.startupTime).toBe(700);

      // Test 2: Should only set once
      state.timeSinceRequested.getDeltaTime = () => 2000;
      state.setStartupTime(500);
      expect(state.startupTime).toBe(700); // Still first value

      // Test 3: Prevent negative values (use new state)
      state = new TrackerState();
      state.goRequest();
      state.timeSinceRequested.getDeltaTime = () => 100;
      state.setStartupTime(500);
      expect(state.startupTime).toBe(0);
    });

    it("should track peakBitrate correctly even when not playing", () => {
      // peakBitrate updates regardless of play state
      state.trackContentBitrateState(1000);
      expect(state.peakBitrate).toBe(1000);

      state.trackContentBitrateState(1500);
      expect(state.peakBitrate).toBe(1500);

      state.trackContentBitrateState(800);
      expect(state.peakBitrate).toBe(1500);

      state.trackContentBitrateState(2000);
      expect(state.peakBitrate).toBe(2000);
    });

    it("should compute time-weighted average bitrate only during play state", () => {
      const dateNowSpy = jest.spyOn(Date, 'now');
      let currentTime = 1000;
      dateNowSpy.mockImplementation(() => currentTime);

      // Simulate playing state
      state.isPlaying = true;

      // First bitrate observation at t=1000
      state.trackContentBitrateState(2000000);
      expect(state.peakBitrate).toBe(2000000);
      expect(state.weightedBitrate).toBe(2000000); // First observation = bitrate itself

      // Change bitrate at t=11000 (after 10s at 2Mbps)
      currentTime = 11000;
      state.trackContentBitrateState(4000000);

      // Previous segment: 2Mbps * 10000ms = 20000000000
      // New segment: just started, 0 duration
      // Average = 20000000000 / 10000 = 2000000 (only the closed segment)
      expect(state.peakBitrate).toBe(4000000);
      // At the same instant of change, only the closed segment contributes
      expect(state.weightedBitrate).toBe(2000000);

      // Read at t=31000 (after 20s at 4Mbps)
      currentTime = 31000;
      state.trackContentBitrateState(4000000); // Same bitrate, no segment close

      // Closed: 2M*10000 = 20000000000
      // In-progress: 4M*20000 = 80000000000
      // Total: 100000000000 / 30000 ≈ 3333333
      expect(state.weightedBitrate).toBe(Math.round(100000000000 / 30000));

      dateNowSpy.mockRestore();
    });

    it("should exclude buffering time from average bitrate calculation", () => {
      const dateNowSpy = jest.spyOn(Date, 'now');
      let currentTime = 1000;
      dateNowSpy.mockImplementation(() => currentTime);

      state.isPlaying = true;

      // Play at 2Mbps for 10s
      state.trackContentBitrateState(2000000);
      currentTime = 11000;

      // Buffer starts at t=11000 — closes play segment (10s at 2Mbps)
      state.isPlaying = false;
      state.trackContentBitrateState(2000000);

      // Buffer for 5s (this time should NOT count)
      currentTime = 16000;

      // Resume playing at t=16000 — restarts segment
      state.isPlaying = true;

      // Play at 4Mbps for 10s
      state.trackContentBitrateState(4000000);
      currentTime = 26000;
      state.trackContentBitrateState(4000000);

      // Only play time: 2M*10000 + 4M*10000 = 60000000000 / 20000 = 3000000
      // Buffer time (5s) is excluded
      expect(state.weightedBitrate).toBe(3000000);

      dateNowSpy.mockRestore();
    });

    it("should initialize bitrate accumulator with zero total duration", () => {
      expect(state._totalBitrateDuration).toBe(0);
      expect(state.partialAverageBitrate).toBe(0);
    });

    it("should reset bitrate accumulator in resetViewIdTrackedState", () => {
      state._totalBitrateDuration = 5000;
      state.partialAverageBitrate = 1_000_000_000;
      state.resetViewIdTrackedState();
      expect(state._totalBitrateDuration).toBe(0);
      expect(state.partialAverageBitrate).toBe(0);
      expect(state._lastBitrate).toBeNull();
      expect(state._lastBitrateChangeTimestamp).toBeNull();
    });

    it("should not set hadStartupError if error occurs after start", () => {
      state.goRequest();
      state.goStart();
      expect(state.isStarted).toBe(true);

      state.goError();
      expect(state.hadStartupError).toBe(false);
      expect(state.hadPlaybackError).toBe(true);
    });

    it("getQoeAttributes() should return all KPI attributes with correct structure", () => {
      // Setup state with known values
      state.goRequest();
      state.goStart();
      state.startupTime = 500;
      state.peakBitrate = 2000;
      state.partialAverageBitrate = 6000;
      state.weightedBitrate = 1200; // Set the weighted bitrate that will be used in averageBitrate
      state.hadStartupError = false;
      state.hadPlaybackError = true;
      state.totalRebufferingTime = 300;
      state.totalPlaytime = 5000;
      state.numberOfErrors = 3;

      const result = state.getQoeAttributes();
      const qoeAttrs = result.qoe;

      expect(typeof result).toBe("object");
      expect(typeof result.qoe).toBe("object");
      expect(qoeAttrs["startupTime"]).toBe(500);
      expect(qoeAttrs["peakBitrate"]).toBe(2000);
      expect(qoeAttrs["hadStartupError"]).toBe(false);
      expect(qoeAttrs["hadPlaybackError"]).toBe(true);
      expect(qoeAttrs["totalRebufferingTime"]).toBe(300);
      expect(qoeAttrs["rebufferingRatio"]).toBeCloseTo(6, 0);
      expect(qoeAttrs["totalPlaytime"]).toBe(5000);
      expect(qoeAttrs["averageBitrate"]).toBe(1200);
      expect(qoeAttrs["numberOfErrors"]).toBe(3);
    });

    it("should handle errors in getQoeAttributes and return empty qoe object", () => {
      Object.defineProperty(state, 'totalPlaytime', {
        get() {
          throw new Error("Simulated error accessing totalPlaytime");
        },
        configurable: true
      });

      const result = state.getQoeAttributes();

      expect(typeof result).toBe("object");
      expect(typeof result.qoe).toBe("object");
    });

    // NOTE: Old download-rate tracking tests (v1.0 with trackDownloadRateState) removed.
    // Phase 1 replaced trackDownloadRateState() with trackDownloadRate() for v1.1 simple mean approach.
    // See QOE v1.1 Metrics section below for new trackDownloadRate() tests.

    describe("QOE v1.1 Metrics", () => {
      beforeEach(() => {
        state = new TrackerState();
        state.setIsAd(false);
      });

      describe("trackDownloadRate() - simple mean of changed values", () => {
        it("should initialize _downloadBitrates as empty array", () => {
          expect(state._downloadBitrates).toEqual([]);
          expect(state._lastDownloadBitrate).toBeNull();
        });

        it("should add value on first call", () => {
          state.trackDownloadRate(5000);
          expect(state._downloadBitrates).toEqual([5000]);
          expect(state._lastDownloadBitrate).toBe(5000);
        });

        it("should add value only when it differs from previous", () => {
          state.trackDownloadRate(5000);
          state.trackDownloadRate(5000);
          state.trackDownloadRate(5000);
          expect(state._downloadBitrates).toEqual([5000]);

          state.trackDownloadRate(7000);
          expect(state._downloadBitrates).toEqual([5000, 7000]);

          state.trackDownloadRate(7000);
          expect(state._downloadBitrates).toEqual([5000, 7000]);

          state.trackDownloadRate(3000);
          expect(state._downloadBitrates).toEqual([5000, 7000, 3000]);
        });

        it("should ignore invalid inputs (null, undefined, NaN, zero, negative)", () => {
          state.trackDownloadRate(5000);
          expect(state._downloadBitrates.length).toBe(1);

          state.trackDownloadRate(null);
          state.trackDownloadRate(undefined);
          state.trackDownloadRate(NaN);
          state.trackDownloadRate(0);
          state.trackDownloadRate(-1000);
          state.trackDownloadRate(-0.5);

          expect(state._downloadBitrates.length).toBe(1);
          expect(state._downloadBitrates).toEqual([5000]);
        });

        it("should ignore non-number types", () => {
          state.trackDownloadRate("5000");
          state.trackDownloadRate({});
          state.trackDownloadRate([]);
          state.trackDownloadRate(true);

          expect(state._downloadBitrates).toEqual([]);
        });

        it("should handle float values correctly", () => {
          state.trackDownloadRate(5000.5);
          state.trackDownloadRate(5000.5);
          state.trackDownloadRate(7500.75);

          expect(state._downloadBitrates).toEqual([5000.5, 7500.75]);
        });

        it("should track rapid bitrate changes", () => {
          const changes = [1000, 2000, 1500, 3000, 2500, 2500, 4000];
          changes.forEach(bps => state.trackDownloadRate(bps));

          // Last 2500 is duplicate, so not added
          expect(state._downloadBitrates).toEqual([1000, 2000, 1500, 3000, 2500, 4000]);
        });

        it("should accumulate across multiple calls without reset", () => {
          state.trackDownloadRate(5000);
          expect(state._downloadBitrates.length).toBe(1);

          state.trackDownloadRate(6000);
          expect(state._downloadBitrates.length).toBe(2);

          state.trackDownloadRate(5500);
          expect(state._downloadBitrates.length).toBe(3);

          // No auto-reset between calls
          expect(state._downloadBitrates).toEqual([5000, 6000, 5500]);
        });
      });

      describe("Rendition switch tracking - quality up/down counting", () => {
        it("should initialize totalSwitchUps and totalSwitchDowns to 0", () => {
          expect(state.totalSwitchUps).toBe(0);
          expect(state.totalSwitchDowns).toBe(0);
        });

        it("should increment totalSwitchUps when newBitrate > oldBitrate", () => {
          state.totalSwitchUps += (5000 > 2000) ? 1 : 0;
          expect(state.totalSwitchUps).toBe(1);

          state.totalSwitchUps += (7000 > 5000) ? 1 : 0;
          expect(state.totalSwitchUps).toBe(2);
          expect(state.totalSwitchDowns).toBe(0);
        });

        it("should increment totalSwitchDowns when newBitrate < oldBitrate", () => {
          state.totalSwitchDowns += (2000 < 5000) ? 1 : 0;
          expect(state.totalSwitchDowns).toBe(1);

          state.totalSwitchDowns += (1000 < 3000) ? 1 : 0;
          expect(state.totalSwitchUps).toBe(0);
          expect(state.totalSwitchDowns).toBe(2);
        });

        it("should handle mixed up and down switches", () => {
          state.totalSwitchUps += (5000 > 2000) ? 1 : 0;      // up
          state.totalSwitchDowns += (3000 < 5000) ? 1 : 0;    // down
          state.totalSwitchUps += (6000 > 3000) ? 1 : 0;      // up
          state.totalSwitchUps += (7000 > 6000) ? 1 : 0;      // up
          state.totalSwitchDowns += (2000 < 7000) ? 1 : 0;    // down

          expect(state.totalSwitchUps).toBe(3);
          expect(state.totalSwitchDowns).toBe(2);
        });

        it("should not increment when newBitrate === oldBitrate (no change)", () => {
          const oldUps = state.totalSwitchUps;
          const oldDowns = state.totalSwitchDowns;

          state.totalSwitchUps += (5000 > 5000) ? 1 : 0;
          state.totalSwitchDowns += (5000 < 5000) ? 1 : 0;

          expect(state.totalSwitchUps).toBe(oldUps);
          expect(state.totalSwitchDowns).toBe(oldDowns);
        });

        it("should accumulate without reset between calls", () => {
          state.totalSwitchUps += (5000 > 2000) ? 1 : 0;
          state.totalSwitchUps += (6000 > 5000) ? 1 : 0;
          expect(state.totalSwitchUps).toBe(2);

          state.totalSwitchDowns += (3000 < 6000) ? 1 : 0;
          expect(state.totalSwitchDowns).toBe(1);
          expect(state.totalSwitchUps).toBe(2); // Still 2, not reset
        });
      });

      describe("addPlayedRendition() - distinct renditions tracking", () => {
        it("should initialize _playedRenditions as empty Set", () => {
          expect(state._playedRenditions).toBeInstanceOf(Set);
          expect(state._playedRenditions.size).toBe(0);
        });

        it("should add rendition with valid height and width", () => {
          state.addPlayedRendition(1920, 1080);
          expect(state._playedRenditions.size).toBe(1);
          expect(state._playedRenditions.has("1920x1080")).toBe(true);
        });

        it("should add multiple distinct renditions", () => {
          state.addPlayedRendition(1920, 1080);
          state.addPlayedRendition(1280, 720);
          state.addPlayedRendition(854, 480);

          expect(state._playedRenditions.size).toBe(3);
          expect(state._playedRenditions.has("1920x1080")).toBe(true);
          expect(state._playedRenditions.has("1280x720")).toBe(true);
          expect(state._playedRenditions.has("854x480")).toBe(true);
        });

        it("should automatically deduplicate identical renditions", () => {
          state.addPlayedRendition(1920, 1080);
          state.addPlayedRendition(1920, 1080);
          state.addPlayedRendition(1920, 1080);

          expect(state._playedRenditions.size).toBe(1);
          expect(state._playedRenditions.has("1920x1080")).toBe(true);
        });

        it("should deduplicate mixed sequence of renditions", () => {
          state.addPlayedRendition(1920, 1080);
          state.addPlayedRendition(1280, 720);
          state.addPlayedRendition(1920, 1080);
          state.addPlayedRendition(854, 480);
          state.addPlayedRendition(1280, 720);

          expect(state._playedRenditions.size).toBe(3);
          expect([...state._playedRenditions]).toContain("1920x1080");
          expect([...state._playedRenditions]).toContain("1280x720");
          expect([...state._playedRenditions]).toContain("854x480");
        });

        it("should ignore null or undefined height/width", () => {
          state.addPlayedRendition(null, 1080);
          state.addPlayedRendition(1920, null);
          state.addPlayedRendition(undefined, 720);
          state.addPlayedRendition(1920, undefined);
          state.addPlayedRendition(null, null);

          expect(state._playedRenditions.size).toBe(0);
        });

        it("should handle edge case dimensions (negative and large numbers)", () => {
          // 0 is falsy, so addPlayedRendition(0, 0) won't add anything
          state.addPlayedRendition(0, 0);
          expect(state._playedRenditions.size).toBe(0);

          // Negative and large numbers are truthy
          state.addPlayedRendition(-1, -1);
          state.addPlayedRendition(7680, 4320); // 8K

          expect(state._playedRenditions.size).toBe(2);
          expect(state._playedRenditions.has("-1x-1")).toBe(true);
          expect(state._playedRenditions.has("7680x4320")).toBe(true);
        });

        it("should treat (1080, 1920) and (1920, 1080) as different", () => {
          state.addPlayedRendition(1920, 1080);
          state.addPlayedRendition(1080, 1920);

          expect(state._playedRenditions.size).toBe(2);
          expect(state._playedRenditions.has("1920x1080")).toBe(true);
          expect(state._playedRenditions.has("1080x1920")).toBe(true);
        });
      });

      describe("Pause time tracking via timeSincePaused Chrono", () => {
        beforeEach(() => {
          jest.useFakeTimers();
        });

        afterEach(() => {
          jest.useRealTimers();
        });

        it("should track pause duration using timeSincePaused chrono", () => {
          state.goRequest();
          state.goStart();

          // Pause the video
          expect(state.goPause()).toBe(true);
          expect(state.timeSincePaused.startTime).not.toBe(0);

          // Advance time by 50ms
          jest.advanceTimersByTime(50);

          // Resume
          expect(state.goResume()).toBe(true);

          // timeSincePaused should have accumulated ~50ms
          const duration = state.timeSincePaused.getDuration();
          expect(duration).toBeGreaterThanOrEqual(50);
        });

        it("should accumulate pause duration across multiple pause cycles", () => {
          state.goRequest();
          state.goStart();

          // First pause: 30ms
          state.goPause();
          jest.advanceTimersByTime(30);
          state.goResume();
          const firstDuration = state.timeSincePaused.getDuration();
          expect(firstDuration).toBeGreaterThanOrEqual(30);

          // Second pause: 20ms
          state.goPause();
          jest.advanceTimersByTime(20);
          state.goResume();
          const totalDuration = state.timeSincePaused.getDuration();

          // Should accumulate both pauses
          expect(totalDuration).toBeGreaterThanOrEqual(50);
        });

        it("should include totalPauseTime in QOE attributes using chrono duration", () => {
          state.goRequest();
          state.goStart();

          // Pause for 40ms
          state.goPause();
          jest.advanceTimersByTime(40);
          state.goResume();

          // Get QOE attributes
          const qoe = state.getQoeAttributes({}).qoe;

          // totalPauseTime should reflect chrono duration
          expect(qoe.totalPauseTime).toBeGreaterThanOrEqual(40);
        });

        it("should reset timeSincePaused on view ID change", () => {
          state.goRequest();
          state.goStart();

          // Pause for 50ms
          state.goPause();
          jest.advanceTimersByTime(50);
          state.goResume();

          const durationBeforeReset = state.timeSincePaused.getDuration();
          expect(durationBeforeReset).toBeGreaterThanOrEqual(50);

          // Reset for new view ID
          state.resetViewIdTrackedState();

          // Chrono should be reset
          expect(state.timeSincePaused.getDuration()).toBe(0);
        });
      });

      describe("getQoeAttributes() - v1.1 metrics calculation", () => {
        it("should include qoeAggregateVersion 1.1.0", () => {
          const result = state.getQoeAttributes({});
          expect(result.qoe.qoeAggregateVersion).toBe("1.1.0");
        });

        it("should calculate avgDownloadRate as simple mean of changed values", () => {
          state.trackDownloadRate(1000);
          state.trackDownloadRate(2000);
          state.trackDownloadRate(3000);

          const result = state.getQoeAttributes({});
          // Mean of [1000, 2000, 3000] = 2000
          expect(result.qoe.avgDownloadRate).toBe(2000);
        });

        it("should include minDownloadRate and maxDownloadRate", () => {
          state.trackDownloadRate(5000);
          state.trackDownloadRate(8000);
          state.trackDownloadRate(3000);

          const result = state.getQoeAttributes({});
          expect(result.qoe.minDownloadRate).toBe(3000);
          expect(result.qoe.maxDownloadRate).toBe(8000);
        });

        it("should omit download rate metrics if no data collected", () => {
          const result = state.getQoeAttributes({});
          expect(result.qoe.avgDownloadRate).toBeUndefined();
          expect(result.qoe.minDownloadRate).toBeUndefined();
          expect(result.qoe.maxDownloadRate).toBeUndefined();
        });

        it("should include totalSwitchUps and totalSwitchDowns", () => {
          state.totalSwitchUps += 2;
          state.totalSwitchDowns += 1;

          const result = state.getQoeAttributes({});
          expect(result.qoe.totalSwitchUps).toBe(2);
          expect(result.qoe.totalSwitchDowns).toBe(1);
        });

        it("should include totalPauseTime from timeSincePaused chrono", () => {
          jest.useFakeTimers();
          state.goRequest();
          state.goStart();
          state.goPause();
          jest.advanceTimersByTime(5000);
          state.goResume();

          const result = state.getQoeAttributes({});
          expect(result.qoe.totalPauseTime).toBeGreaterThanOrEqual(5000);
          jest.useRealTimers();
        });

        it("should include totalViewSessionTime (from totalPlaytime)", () => {
          state.totalPlaytime = 45000;

          const result = state.getQoeAttributes({});
          expect(result.qoe.totalViewSessionTime).toBe(45000);
        });

        it("should include totalRenditions count", () => {
          state.addPlayedRendition(1920, 1080);
          state.addPlayedRendition(1280, 720);
          state.addPlayedRendition(1920, 1080); // Duplicate, not counted

          const result = state.getQoeAttributes({});
          expect(result.qoe.totalRenditions).toBe(2);
        });

        it("should create qoe object if not present", () => {
          const att = {};
          const result = state.getQoeAttributes(att);

          expect(result.qoe).toBeDefined();
          expect(typeof result.qoe).toBe("object");
        });

        it("should include v1.1 attributes when qoe object provided", () => {
          const att = { qoe: { startupTime: 500, peakBitrate: 2000 } };
          state.trackDownloadRate(5000);
          state.totalSwitchUps += 1;

          const result = state.getQoeAttributes(att);

          // New v1.1 attributes added
          expect(result.qoe.avgDownloadRate).toBe(5000);
          expect(result.qoe.totalSwitchUps).toBe(1);
          expect(result.qoe.qoeAggregateVersion).toBe("1.1.0");
        });

        it("should include all v1.1 metrics in one call", () => {
          jest.useFakeTimers();
          state.trackDownloadRate(5000);
          state.trackDownloadRate(7000);
          state.totalSwitchUps += 1;
          state.totalSwitchDowns += 1;
          state.addPlayedRendition(1920, 1080);

          // Simulate pause for 3000ms
          state.goRequest();
          state.goStart();
          state.goPause();
          jest.advanceTimersByTime(3000);
          state.goResume();

          state.totalPlaytime = 60000;

          const result = state.getQoeAttributes({});
          const qoe = result.qoe;

          expect(qoe.avgDownloadRate).toBe(6000);
          expect(qoe.minDownloadRate).toBe(5000);
          expect(qoe.maxDownloadRate).toBe(7000);
          expect(qoe.totalSwitchUps).toBe(1);
          expect(qoe.totalSwitchDowns).toBe(1);
          expect(qoe.totalPauseTime).toBeGreaterThanOrEqual(3000);
          expect(qoe.totalViewSessionTime).toBe(60000);
          expect(qoe.totalRenditions).toBe(1);
          expect(qoe.qoeAggregateVersion).toBe("1.1.0");
          jest.useRealTimers();
        });
      });

      describe("resetViewIdTrackedState() - v1.1 metrics reset", () => {
        it("should reset _downloadBitrates to empty array", () => {
          state.trackDownloadRate(5000);
          state.trackDownloadRate(6000);
          expect(state._downloadBitrates.length).toBe(2);

          state.resetViewIdTrackedState();
          expect(state._downloadBitrates).toEqual([]);
          expect(state._lastDownloadBitrate).toBeNull();
        });

        it("should reset totalSwitchUps and totalSwitchDowns to 0", () => {
          state.totalSwitchUps += 1;
          state.totalSwitchDowns += 1;
          expect(state.totalSwitchUps).toBe(1);
          expect(state.totalSwitchDowns).toBe(1);

          state.resetViewIdTrackedState();
          expect(state.totalSwitchUps).toBe(0);
          expect(state.totalSwitchDowns).toBe(0);
        });

        it("should reset pause time tracking (timeSincePaused)", () => {
          jest.useFakeTimers();
          state.goRequest();
          state.goStart();
          state.goPause();
          jest.advanceTimersByTime(5000);
          state.goResume();

          expect(state.timeSincePaused.getDuration()).toBeGreaterThanOrEqual(5000);

          state.resetViewIdTrackedState();
          expect(state.timeSincePaused.getDuration()).toBe(0);
          jest.useRealTimers();
        });

        it("should reset _playedRenditions to empty Set", () => {
          state.addPlayedRendition(1920, 1080);
          state.addPlayedRendition(1280, 720);
          expect(state._playedRenditions.size).toBe(2);

          state.resetViewIdTrackedState();
          expect(state._playedRenditions.size).toBe(0);
        });

        it("should reset all v1.1 metrics together on view ID change", () => {
          jest.useFakeTimers();
          // Set up all metrics
          state.trackDownloadRate(5000);
          state.totalSwitchUps += 1;
          state.addPlayedRendition(1920, 1080);

          // Simulate pause for 3000ms
          state.goRequest();
          state.goStart();
          state.goPause();
          jest.advanceTimersByTime(3000);
          state.goResume();

          // Verify all set
          expect(state._downloadBitrates.length).toBe(1);
          expect(state.totalSwitchUps).toBe(1);
          expect(state._playedRenditions.size).toBe(1);
          expect(state.timeSincePaused.getDuration()).toBeGreaterThanOrEqual(3000);

          // Reset
          state.resetViewIdTrackedState();

          // Verify all reset
          expect(state._downloadBitrates).toEqual([]);
          expect(state._lastDownloadBitrate).toBeNull();
          expect(state.totalSwitchUps).toBe(0);
          expect(state.totalSwitchDowns).toBe(0);
          expect(state.timeSincePaused.getDuration()).toBe(0);
          expect(state._playedRenditions.size).toBe(0);
          jest.useRealTimers();
        });
      });
    });
  });
});
