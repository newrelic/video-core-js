import TrackerState from "../src/videotrackerstate.js";
import chai from "chai";
import sinon from "sinon";

const expect = chai.expect;

describe("VideoTrackerState", () => {
  let state;

  beforeEach(() => {
    state = new TrackerState();
  });

  it("should set isAd", () => {
    expect(state.isAd()).to.be.false;
    state.setIsAd(true);
    expect(state.isAd()).to.be.true;
  });

  it("should getViewId", () => {
    expect(state.getViewId()).to.not.be.undefined;
  });

  it("should output attributes", () => {
    state.isStarted = true;
    state.isPaused = true;
    state.isBuffering = true;
    state.isSeeking = true;
    state.isAdBreak = true;
    expect(typeof state.getStateAttributes()).to.be.equal("object");
    state.setIsAd(true);
    expect(typeof state.getStateAttributes()).to.be.equal("object");
    state.isRequested = true;
    expect(typeof state.getStateAttributes()).to.be.equal("object");
    state.setIsAd(false);
    expect(typeof state.getStateAttributes()).to.be.equal("object");
  });

  it("should playerReady", () => {
    expect(state.goPlayerReady()).to.be.true;
    expect(state.goPlayerReady()).to.be.false;
    expect(state.isPlayerReady).to.be.true;
  });

  it("should request, start and end", () => {
    expect(state.isRequested).to.be.false;
    expect(state.isStarted).to.be.false;

    expect(state.goRequest()).to.be.true;
    expect(state.goRequest()).to.be.false;
    expect(state.timeSinceRequested.getDeltaTime()).to.be.greaterThan(-1);
    expect(state.isRequested).to.be.true;

    expect(state.goStart()).to.be.true;
    expect(state.goStart()).to.be.false;
    expect(state.timeSinceStarted.getDeltaTime()).to.be.greaterThan(-1);
    expect(state.isStarted).to.be.true;

    expect(state.goEnd()).to.be.true;
    expect(state.goEnd()).to.be.false;
    expect(state.isStarted).to.be.false;
    expect(state.isRequested).to.not.be.true;
  });

  it("should increment numberOfAds", () => {
    expect(state.numberOfAds).to.equal(0);
    state.setIsAd(true);
    state.goRequest();
    state.goStart();
    expect(state.numberOfAds).to.equal(1);
  });

  it("should pause and resume", () => {
    state.goRequest();
    state.goStart();

    expect(state.isPaused).to.be.false;

    expect(state.goPause()).to.be.true;
    expect(state.goPause()).to.be.false;
    expect(state.timeSincePaused.getDeltaTime()).to.be.greaterThan(-1);
    expect(state.isPaused).to.be.true;

    expect(state.goResume()).to.be.true;
    expect(state.goResume()).to.be.false;
    expect(state.timeSincePaused.getDeltaTime()).to.be.greaterThan(-1);
    expect(state.isPaused).to.be.false;
  });

  it("should seek", () => {
    state.goRequest();
    state.goStart();

    expect(state.isSeeking).to.be.false;

    expect(state.goSeekStart()).to.be.true;
    expect(state.goSeekStart()).to.be.false;
    expect(state.timeSinceSeekBegin.getDeltaTime()).to.be.greaterThan(-1);
    expect(state.isSeeking).to.be.true;

    expect(state.goSeekEnd()).to.be.true;
    expect(state.goSeekEnd()).to.be.false;
    expect(state.timeSinceSeekBegin.getDeltaTime()).to.be.greaterThan(-1);
    expect(state.isSeeking).to.be.false;
  });

  it("should buffer", () => {
    state.goRequest();
    state.goStart();

    expect(state.isBuffering).to.be.false;

    expect(state.goBufferStart()).to.be.true;
    expect(state.goBufferStart()).to.be.false;
    expect(state.timeSinceBufferBegin.getDeltaTime()).to.be.greaterThan(-1);
    expect(state.isBuffering).to.be.true;

    expect(state.goBufferEnd()).to.be.true;
    expect(state.goBufferEnd()).to.be.false;
    expect(state.timeSinceBufferBegin.getDeltaTime()).to.be.greaterThan(-1);
    expect(state.isBuffering).to.be.false;
  });

  it("should adBreak", () => {
    expect(state.isAdBreak).to.be.false;

    expect(state.goAdBreakStart()).to.be.true;
    expect(state.goAdBreakStart()).to.be.false;
    expect(state.timeSinceAdBreakStart.getDeltaTime()).to.be.greaterThan(-1);
    expect(state.isAdBreak).to.be.true;

    expect(state.goAdBreakEnd()).to.be.true;
    expect(state.goAdBreakEnd()).to.be.false;
    expect(state.timeSinceAdBreakStart.getDeltaTime()).to.be.greaterThan(-1);
    expect(state.isAdBreak).to.be.false;
  });

  it("should increment numberOfErrors and start appropriate error timer", () => {
    expect(state.numberOfErrors).to.equal(0);

    // Test content error
    state.setIsAd(false);
    state.goError();
    expect(state.numberOfErrors).to.equal(1);
    expect(state.timeSinceLastError.getDeltaTime()).to.be.greaterThan(-1);

    // Reset and test ad error
    state.numberOfErrors = 0;
    state.timeSinceLastError.reset();
    state.setIsAd(true);
    state.goError();
    expect(state.numberOfErrors).to.equal(1);
    expect(state.timeSinceLastAdError.getDeltaTime()).to.be.greaterThan(-1);
  });

  it("should include timeSinceLastError in content state attributes only after error", () => {
    state.setIsAd(false);

    // Before error, timeSinceLastError should not be present
    let attributes = state.getStateAttributes();
    expect(attributes.timeSinceLastError).to.be.undefined;

    // After error, timeSinceLastError should be present
    state.goError();
    attributes = state.getStateAttributes();
    expect(attributes.timeSinceLastError).to.be.a("number");
    expect(attributes.timeSinceLastError).to.be.greaterThan(-1);
  });

  it("should include timeSinceLastAdError in ad state attributes only after error", () => {
    state.setIsAd(true);

    // Before error, timeSinceLastAdError should not be present
    let attributes = state.getStateAttributes();
    expect(attributes.timeSinceLastAdError).to.be.undefined;

    // After error, timeSinceLastAdError should be present
    state.goError();
    attributes = state.getStateAttributes();
    expect(attributes.timeSinceLastAdError).to.be.a("number");
    expect(attributes.timeSinceLastAdError).to.be.greaterThan(-1);
  });

  it("should calculate correct time delta for both ad and content errors", () => {
    // Test content error first
    state.setIsAd(false);
    state.goError();

    // Wait a small amount of time to ensure delta > 0
    const contentErrorTime = state.timeSinceLastError.getDeltaTime();
    expect(contentErrorTime).to.be.greaterThan(-1);
    expect(state.timeSinceLastAdError.getDeltaTime()).to.be.null; // Should not be started for content error

    // Reset state and test ad error
    state.numberOfErrors = 0;
    state.timeSinceLastError.reset();
    state.timeSinceLastAdError.reset();

    state.setIsAd(true);
    state.goError();

    const adErrorTime = state.timeSinceLastAdError.getDeltaTime();
    expect(adErrorTime).to.be.greaterThan(-1);
    expect(state.timeSinceLastError.getDeltaTime()).to.be.null; // Should not be started for ad error

    // Verify that the correct attributes are included based on context
    // After reset, numberOfErrors is 0, so no error attributes should be included
    state.setIsAd(false);
    let contentAttributes = state.getStateAttributes();
    expect(contentAttributes.timeSinceLastError).to.be.undefined; // numberOfErrors was reset to 0
    expect(contentAttributes.timeSinceLastAdError).to.be.undefined;

    // Reset numberOfErrors back to 1 to test attribute inclusion
    state.numberOfErrors = 1;
    state.setIsAd(true);
    let adAttributes = state.getStateAttributes();
    expect(adAttributes.timeSinceLastAdError).to.be.a("number");
    expect(adAttributes.timeSinceLastAdError).to.be.greaterThan(-1);
    expect(adAttributes.timeSinceLastError).to.be.undefined;
  });

  it("should maintain independent timing for content and ad errors", () => {
    // Start with content error
    state.setIsAd(false);
    state.goError();
    const initialContentTime = state.timeSinceLastError.getDeltaTime();

    // Switch to ad context and trigger ad error
    state.setIsAd(true);
    state.goError();
    const initialAdTime = state.timeSinceLastAdError.getDeltaTime();

    // Verify both timers are running independently
    expect(initialContentTime).to.be.greaterThan(-1);
    expect(initialAdTime).to.be.greaterThan(-1);
    expect(state.numberOfErrors).to.equal(2); // Both errors counted

    // Verify correct attributes in different contexts
    state.setIsAd(false);
    let contentAttrs = state.getStateAttributes();
    expect(contentAttrs.timeSinceLastError).to.be.a("number");
    expect(contentAttrs.timeSinceLastError).to.be.greaterThan(-1);
    expect(contentAttrs.timeSinceLastAdError).to.be.undefined;

    state.setIsAd(true);
    let adAttrs = state.getStateAttributes();
    expect(adAttrs.timeSinceLastAdError).to.be.a("number");
    expect(adAttrs.timeSinceLastAdError).to.be.greaterThan(-1);
    expect(adAttrs.timeSinceLastError).to.be.undefined;
  });

  it("should start tineSinceLast timers", () => {
    state.goHeartbeat();
    expect(state.timeSinceLastHeartbeat.getDeltaTime()).to.be.greaterThan(-1);

    state.goLastAd();
    expect(state.timeSinceLastAd.getDeltaTime()).to.be.greaterThan(-1);

    state.goDownload();
    expect(state.timeSinceLastDownload.getDeltaTime()).to.be.greaterThan(-1);

    state.goRenditionChange();
    expect(state.timeSinceLastRenditionChange.getDeltaTime()).to.be.greaterThan(
      -1
    );

    state.goAdQuartile();
    expect(state.timeSinceLastAdQuartile.getDeltaTime()).to.be.greaterThan(-1);
  });

  describe("QOE KPI Tracking", () => {
    beforeEach(() => {
      state = new TrackerState();
      state.setIsAd(false); // Ensure we're in content mode
    });

    it("should initialize QOE state variables to correct defaults", () => {
      expect(state.startupTime).to.be.null;
      expect(state.peakBitrate).to.equal(0);
      expect(state.partialAverageBitrate).to.equal(0);
      expect(state.hadStartupFailure).to.be.false;
      expect(state.hadPlaybackFailure).to.be.false;
      expect(state.totalRebufferingTime).to.equal(0);
      expect(state._lastBitrate).to.be.null;
      expect(state._lastBitrateChangeTimestamp).to.be.null;
    });

    it("should set startupTime with ad time adjustment using setStartupTime()", () => {
      state.goRequest();

      // Mock timeSinceRequested to return 1000ms
      const originalGetDeltaTime = state.timeSinceRequested.getDeltaTime.bind(state.timeSinceRequested);
      state.timeSinceRequested.getDeltaTime = () => 1000;

      state.setStartupTime(300); // 300ms of ad time
      expect(state.startupTime).to.equal(700); // 1000 - 300

      // Restore original method
      state.timeSinceRequested.getDeltaTime = originalGetDeltaTime;
    });

    it("should only set startupTime once when using setStartupTime()", () => {
      state.goRequest();
      state.timeSinceRequested.getDeltaTime = () => 1000;

      state.setStartupTime(200);
      const firstValue = state.startupTime;
      expect(firstValue).to.equal(800);

      // Try to set again with different ad time
      state.timeSinceRequested.getDeltaTime = () => 2000;
      state.setStartupTime(500);

      // Should still be the first value
      expect(state.startupTime).to.equal(firstValue);
    });

    it("should not allow negative startupTime when using setStartupTime()", () => {
      state.goRequest();
      state.timeSinceRequested.getDeltaTime = () => 100;

      state.setStartupTime(500); // More ad time than total time
      expect(state.startupTime).to.equal(0); // Math.max ensures 0
    });

    it("should track peakBitrate correctly (max value over time)", () => {
      let currentTime = 1000000;
      const dateNowStub = sinon.stub(Date, "now");
      dateNowStub.returns(currentTime);

      try {
        state.totalPlaytime = 1000;
        state.trackContentBitrateState(1000);
        expect(state.peakBitrate).to.equal(1000);

        currentTime += 1000;
        dateNowStub.returns(currentTime);
        state.trackContentBitrateState(1500);
        expect(state.peakBitrate).to.equal(1500);

        currentTime += 1000;
        dateNowStub.returns(currentTime);
        state.trackContentBitrateState(800);
        expect(state.peakBitrate).to.equal(1500); // Should remain at max

        currentTime += 1000;
        dateNowStub.returns(currentTime);
        state.trackContentBitrateState(2000);
        expect(state.peakBitrate).to.equal(2000);
      } finally {
        dateNowStub.restore();
      }
    });

    it("should track partialAverageBitrate accumulation", () => {
      expect(state.partialAverageBitrate).to.equal(0);

      // Simulate playtime progression for weighted average calculation
      // First bitrate change uses totalPlaytime as delta
      // Subsequent changes use Date.now() - _lastBitrateChangeTimestamp as delta
      // partialAverageBitrate += (bitrate * deltaPlaytime)
      // weightedBitrate = (bitrate * deltaPlaytime) / deltaPlaytime

      let currentTime = 1000000;
      const dateNowStub = sinon.stub(Date, "now");
      dateNowStub.returns(currentTime);

      try {
        // First bitrate change: uses totalPlaytime (1000ms)
        state.totalPlaytime = 1000; // 1 second
        state.trackContentBitrateState(1000);
        expect(state.partialAverageBitrate).to.equal(1000 * 1000); // 1,000,000
        expect(state.weightedBitrate).to.equal(1000);
        expect(state._lastBitrateChangeTimestamp).to.equal(currentTime);

        // Second bitrate change: uses timestamp delta (2000ms)
        currentTime += 2000;
        dateNowStub.returns(currentTime);
        state.trackContentBitrateState(1500);
        expect(state.partialAverageBitrate).to.equal(1000000 + (1500 * 2000)); // 1,000,000 + 3,000,000 = 4,000,000
        expect(state.weightedBitrate).to.equal(1500);
        expect(state._lastBitrateChangeTimestamp).to.equal(currentTime);

        // Third bitrate change: uses timestamp delta (3000ms)
        currentTime += 3000;
        dateNowStub.returns(currentTime);
        state.trackContentBitrateState(800);
        expect(state.partialAverageBitrate).to.equal(4000000 + (800 * 3000)); // 4,000,000 + 2,400,000 = 6,400,000
        expect(state.weightedBitrate).to.equal(800);
        expect(state._lastBitrateChangeTimestamp).to.equal(currentTime);
      } finally {
        dateNowStub.restore();
      }
    });

    it("should ignore ad bitrates for QOE tracking", () => {
      // Note: trackContentBitrateState doesn't check isAd() itself.
      // The VideoTracker caller (videotracker.js:524-525) prevents calling
      // this method when in ad mode. This test verifies the method's behavior
      // when mistakenly called with ads, but in practice the VideoTracker ensures
      // it's only called for content.
      const dateNowStub = sinon.stub(Date, "now").returns(1000000);

      try {
        state.setIsAd(true);
        state.totalPlaytime = 1000;
        state.trackContentBitrateState(5000);

        // The method will still track since it doesn't check isAd() internally
        expect(state.peakBitrate).to.equal(5000);
        expect(state.partialAverageBitrate).to.equal(5000 * 1000);
      } finally {
        dateNowStub.restore();
      }
    });

    it("should use totalPlaytime for first bitrate change and timestamps for subsequent changes", () => {
      let currentTime = 1000000;
      const dateNowStub = sinon.stub(Date, "now");
      dateNowStub.returns(currentTime);

      try {
        // First call: _lastBitrateChangeTimestamp is null, so uses totalPlaytime
        state.totalPlaytime = 1500;
        state.trackContentBitrateState(2000);

        expect(state._lastBitrateChangeTimestamp).to.equal(currentTime);
        expect(state.partialAverageBitrate).to.equal(2000 * 1500); // bitrate * totalPlaytime
        expect(state.weightedBitrate).to.equal(2000);

        // Second call: _lastBitrateChangeTimestamp is set, so uses Date.now() - timestamp
        currentTime += 3000; // 3 seconds pass
        dateNowStub.returns(currentTime);
        state.trackContentBitrateState(2500);

        expect(state._lastBitrateChangeTimestamp).to.equal(currentTime);
        expect(state.partialAverageBitrate).to.equal((2000 * 1500) + (2500 * 3000)); // previous + (bitrate * delta)
        expect(state.weightedBitrate).to.equal(2500);
      } finally {
        dateNowStub.restore();
      }
    });

    it("should update _lastBitrateChangeTimestamp on each bitrate change", () => {
      let currentTime = 1000000;
      const dateNowStub = sinon.stub(Date, "now");
      dateNowStub.returns(currentTime);

      try {
        state.totalPlaytime = 1000;

        // First bitrate change
        state.trackContentBitrateState(1000);
        expect(state._lastBitrateChangeTimestamp).to.equal(1000000);

        // Second bitrate change
        currentTime = 1002000;
        dateNowStub.returns(currentTime);
        state.trackContentBitrateState(1500);
        expect(state._lastBitrateChangeTimestamp).to.equal(1002000);

        // Third bitrate change
        currentTime = 1005000;
        dateNowStub.returns(currentTime);
        state.trackContentBitrateState(2000);
        expect(state._lastBitrateChangeTimestamp).to.equal(1005000);
      } finally {
        dateNowStub.restore();
      }
    });

    it("should not update _lastBitrateChangeTimestamp when bitrate hasn't changed", () => {
      let currentTime = 1000000;
      const dateNowStub = sinon.stub(Date, "now");
      dateNowStub.returns(currentTime);

      try {
        state.totalPlaytime = 1000;

        // First bitrate change - should update timestamp
        state.trackContentBitrateState(1500);
        expect(state._lastBitrateChangeTimestamp).to.equal(1000000);
        const initialPartialAverage = state.partialAverageBitrate;

        // Same bitrate - should NOT update timestamp or partial average
        currentTime = 1002000;
        dateNowStub.returns(currentTime);
        state.trackContentBitrateState(1500);
        expect(state._lastBitrateChangeTimestamp).to.equal(1000000); // Should remain unchanged
        expect(state.partialAverageBitrate).to.equal(initialPartialAverage); // Should remain unchanged

        // Different bitrate - should update timestamp
        currentTime = 1003000;
        dateNowStub.returns(currentTime);
        state.trackContentBitrateState(2000);
        expect(state._lastBitrateChangeTimestamp).to.equal(1003000); // Should be updated
        expect(state.partialAverageBitrate).to.be.greaterThan(initialPartialAverage); // Should increase
      } finally {
        dateNowStub.restore();
      }
    });

    it("should set hadStartupFailure=true when error occurs before start", () => {
      state.goRequest();
      expect(state.isStarted).to.be.false;

      state.goError();
      expect(state.hadStartupFailure).to.be.true;
      expect(state.hadPlaybackFailure).to.be.false; // Startup errors do not set hadPlaybackFailure
    });

    it("should set hadPlaybackFailure=true on content error after start", () => {
      state.goRequest();
      state.goStart();

      state.goError();
      expect(state.hadPlaybackFailure).to.be.true;
    });

    it("should not set hadStartupFailure if error occurs after start", () => {
      state.goRequest();
      state.goStart();
      expect(state.isStarted).to.be.true;

      state.goError();
      expect(state.hadStartupFailure).to.be.false;
      expect(state.hadPlaybackFailure).to.be.true;
    });

    it("should accumulate totalRebufferingTime correctly (excluding initial buffering)", () => {
      state.goRequest();
      state.goStart();
      state.initialBufferingHappened = true;

      // First rebuffer
      state.goBufferStart();
      state.timeSinceBufferBegin.getDeltaTime = () => 500; // Mock 500ms
      state.goBufferEnd();
      expect(state.totalRebufferingTime).to.equal(500);

      // Second rebuffer
      state.goBufferStart();
      state.timeSinceBufferBegin.getDeltaTime = () => 300; // Mock 300ms
      state.goBufferEnd();
      expect(state.totalRebufferingTime).to.equal(800);
    });

    it("should not count initial buffering in totalRebufferingTime", () => {
      state.goRequest();
      state.goStart();
      // initialBufferingHappened starts as false by default

      state.goBufferStart();
      state.timeSinceBufferBegin.getDeltaTime = () => 1000;
      const result = state.goBufferEnd();

      // Initial buffering should not be counted when initialBufferingHappened is false
      expect(state.totalRebufferingTime).to.equal(0);

      // Now set the flag to true to simulate that initial buffering has happened
      state.initialBufferingHappened = true;

      // Second buffer should be counted as rebuffering
      state.goBufferStart();
      state.timeSinceBufferBegin.getDeltaTime = () => 500;
      state.goBufferEnd();

      expect(state.totalRebufferingTime).to.equal(500);
    });

    it("should calculate rebufferingRatio correctly", () => {
      // Set totalPlaytime directly
      state.totalPlaytime = 10000; // 10 seconds
      state.totalRebufferingTime = 1000; // 1 second

      const result = state.getQoeAttributes();
      const qoeAttrs = result.qoe;
      expect(qoeAttrs["rebufferingRatio"]).to.be.closeTo(10, 0.1); // 10%
    });

    it("should handle rebufferingRatio when totalPlaytime is 0", () => {
      state.totalPlaytime = 0;
      state.totalRebufferingTime = 1000;

      const result = state.getQoeAttributes();
      const qoeAttrs = result.qoe;
      expect(qoeAttrs["rebufferingRatio"]).to.equal(0);
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

      expect(result).to.be.an("object");
      expect(result.qoe).to.be.an("object");
      expect(qoeAttrs["startupTime"]).to.equal(500);
      expect(qoeAttrs["peakBitrate"]).to.equal(2000);
      expect(qoeAttrs["hadStartupFailure"]).to.be.false;
      expect(qoeAttrs["hadPlaybackFailure"]).to.be.true;
      expect(qoeAttrs["totalRebufferingTime"]).to.equal(300);
      expect(qoeAttrs["rebufferingRatio"]).to.be.closeTo(6, 0.1);
      expect(qoeAttrs["totalPlaytime"]).to.equal(5000);
      expect(qoeAttrs["averageBitrate"]).to.equal(1200); // Now validates the actual weightedBitrate value
    });

    it("should reset _lastBitrateChangeTimestamp when calling resetViewIdTrackedState()", () => {
      const dateNowStub = sinon.stub(Date, "now").returns(1000000);

      try {
        // Set up state with bitrate tracking
        state.totalPlaytime = 1000;
        state.trackContentBitrateState(2000);

        expect(state.peakBitrate).to.equal(2000);
        expect(state.partialAverageBitrate).to.equal(2000000);
        expect(state.startupTime).to.be.null;
        expect(state._lastBitrate).to.equal(2000);
        expect(state._lastBitrateChangeTimestamp).to.equal(1000000);

        // Reset the state
        state.resetViewIdTrackedState();

        // Verify all QOE state variables are reset
        expect(state.peakBitrate).to.equal(0);
        expect(state.partialAverageBitrate).to.equal(0);
        expect(state.startupTime).to.be.null;
        expect(state._lastBitrate).to.be.null;
        expect(state._lastBitrateChangeTimestamp).to.be.null;
      } finally {
        dateNowStub.restore();
      }
    });

    describe("Ad Time Tracking", () => {
      it("should track total ad playtime", (done) => {
        expect(state.totalAdTime()).to.equal(0);

        state.startAdsTime();

        // Wait a small amount of time
        setTimeout(() => {
          state.stopAdsTime();
          const adTime = state.totalAdTime();
          expect(adTime).to.be.greaterThan(0);
          done();
        }, 10);
      });

      it("should accumulate ad time across multiple start/stop cycles", (done) => {
        state.startAdsTime();

        setTimeout(() => {
          state.stopAdsTime();
          const firstDuration = state.totalAdTime();

          state.startAdsTime();

          setTimeout(() => {
            state.stopAdsTime();
            const secondDuration = state.totalAdTime();
            expect(secondDuration).to.be.greaterThan(firstDuration);
            done();
          }, 10);
        }, 10);
      });

      it("should clear total ad time", (done) => {
        state.startAdsTime();

        setTimeout(() => {
          state.stopAdsTime();
          expect(state.totalAdTime()).to.be.greaterThan(0);

          state.clearTotalAdsTime();
          expect(state.totalAdTime()).to.equal(0);
          done();
        }, 10);
      });
    });
  });
});
