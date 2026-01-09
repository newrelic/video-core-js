import TrackerState from "../src/videotrackerstate.js";

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
    state.setIsAd(false);
    state.goRequest();
    state.goStart();

    let attributes = state.getStateAttributes();
    expect(attributes.playtimeSinceLastEvent).toBe(0);

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
      expect(state.hadStartupFailure).toBe(false);
      expect(state.hadPlaybackFailure).toBe(false);
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

    it("should track peakBitrate correctly (max value over time)", () => {
      state.trackContentBitrateState(1000);
      expect(state.peakBitrate).toBe(1000);

      state.trackContentBitrateState(1500);
      expect(state.peakBitrate).toBe(1500);

      state.trackContentBitrateState(800);
      expect(state.peakBitrate).toBe(1500); 

      state.trackContentBitrateState(2000);
      expect(state.peakBitrate).toBe(2000);
    });

    it("should not set hadStartupFailure if error occurs after start", () => {
      state.goRequest();
      state.goStart();
      expect(state.isStarted).toBe(true);

      state.goError();
      expect(state.hadStartupFailure).toBe(false);
      expect(state.hadPlaybackFailure).toBe(true);
    });

    it("getQoeAttributes() should return all KPI attributes with correct structure", () => {
      // Setup state with known values
      state.goRequest();
      state.goStart();
      state.startupTime = 500;
      state.peakBitrate = 2000;
      state.partialAverageBitrate = 6000;
      state.weightedBitrate = 1200; // Set the weighted bitrate that will be used in averageBitrate
      state.hadStartupFailure = false;
      state.hadPlaybackFailure = true;
      state.totalRebufferingTime = 300;
      state.totalPlaytime = 5000;

      const result = state.getQoeAttributes();
      const qoeAttrs = result.qoe;

      expect(typeof result).toBe("object");
      expect(typeof result.qoe).toBe("object");
      expect(qoeAttrs["startupTime"]).toBe(500);
      expect(qoeAttrs["peakBitrate"]).toBe(2000);
      expect(qoeAttrs["hadStartupFailure"]).toBe(false);
      expect(qoeAttrs["hadPlaybackFailure"]).toBe(true);
      expect(qoeAttrs["totalRebufferingTime"]).toBe(300);
      expect(qoeAttrs["rebufferingRatio"]).toBeCloseTo(6, 0);
      expect(qoeAttrs["totalPlaytime"]).toBe(5000);
      expect(qoeAttrs["averageBitrate"]).toBe(1200); 
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
  });
});
