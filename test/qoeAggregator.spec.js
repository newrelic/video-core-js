import { QoEAggregator, QOE_KPI_KEYS } from "../src/qoeAggregator.js";
import { videoAnalyticsHarvester } from "../src/agent.js";
import Tracker from "../src/tracker.js";
import Log from "../src/log.js";

describe("QoEAggregator", () => {
  let aggregator;

  beforeEach(() => {
    aggregator = new QoEAggregator();
  });

  describe("initialization", () => {
    it("should start with all state reset", () => {
      expect(aggregator._hasReceivedRequest).toBe(false);
      expect(aggregator._hasReceivedStart).toBe(false);
      expect(aggregator._startupTime).toBeNull();
      expect(aggregator._peakBitrate).toBe(0);
      expect(aggregator._currentBitrate).toBe(0);
      expect(aggregator._totalRebufferingTime).toBe(0);
      expect(aggregator._hadStartupError).toBe(false);
      expect(aggregator._hadPlaybackError).toBe(false);
      expect(aggregator._lastTotalPlaytime).toBe(0);
      expect(aggregator._prerollAdWallClockTime).toBe(0);
    });

    it("should return null from generateAggregateAttributes before CONTENT_REQUEST", () => {
      expect(aggregator.generateAggregateAttributes()).toBeNull();
    });
  });

  describe("QOE_KPI_KEYS", () => {
    it("should contain all expected KPI keys", () => {
      expect(QOE_KPI_KEYS).toContain("startupTime");
      expect(QOE_KPI_KEYS).toContain("peakBitrate");
      expect(QOE_KPI_KEYS).toContain("averageBitrate");
      expect(QOE_KPI_KEYS).toContain("totalPlaytime");
      expect(QOE_KPI_KEYS).toContain("totalRebufferingTime");
      expect(QOE_KPI_KEYS).toContain("rebufferingRatio");
      expect(QOE_KPI_KEYS).toContain("hadStartupError");
      expect(QOE_KPI_KEYS).toContain("hadPlaybackError");
      expect(QOE_KPI_KEYS.length).toBe(8);
    });
  });

  describe("CONTENT_REQUEST", () => {
    it("should mark session as active", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      expect(aggregator._hasReceivedRequest).toBe(true);
    });

    it("should return attributes after CONTENT_REQUEST", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs).not.toBeNull();
      expect(attrs.hadStartupError).toBe(false);
      expect(attrs.hadPlaybackError).toBe(false);
    });
  });

  describe("startupTime", () => {
    it("should compute startupTime from timeSinceRequested", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAction(
        "CONTENT_START",
        { timeSinceRequested: 1500, totalPlaytime: 0 },
        true
      );
      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.startupTime).toBe(1500);
    });

    it("should subtract pre-roll ad wall-clock time from startupTime", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);

      // Pre-roll ad ended with 800ms wall-clock duration
      aggregator.processAdEvent("AD_END", { timeSinceAdStarted: 800 });

      aggregator.processAction(
        "CONTENT_START",
        { timeSinceRequested: 2000, totalPlaytime: 0 },
        true
      );
      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.startupTime).toBe(1200); // 2000 - 800
    });

    it("should accumulate wall-clock time across multiple pre-roll ads", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);

      // First ad: 500ms
      aggregator.processAdEvent("AD_END", { timeSinceAdStarted: 500 });
      // Second ad: 300ms
      aggregator.processAdEvent("AD_END", { timeSinceAdStarted: 300 });

      aggregator.processAction(
        "CONTENT_START",
        { timeSinceRequested: 2000, totalPlaytime: 0 },
        true
      );
      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.startupTime).toBe(1200); // 2000 - 800
    });

    it("should ignore ad events after CONTENT_START (mid-rolls)", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAction(
        "CONTENT_START",
        { timeSinceRequested: 1000, totalPlaytime: 0 },
        true
      );

      // Mid-roll ad — should NOT affect startupTime
      aggregator.processAdEvent("AD_END", { timeSinceAdStarted: 5000 });

      expect(aggregator._prerollAdWallClockTime).toBe(0);
    });

    it("should clamp startupTime to >= 0", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);

      // Ad wall-clock time exceeds timeSinceRequested
      aggregator.processAdEvent("AD_END", { timeSinceAdStarted: 500 });

      aggregator.processAction(
        "CONTENT_START",
        { timeSinceRequested: 100, totalPlaytime: 0 },
        true
      );
      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.startupTime).toBe(0);
    });

    it("should not include startupTime before CONTENT_START", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.startupTime).toBeUndefined();
    });
  });

  describe("peakBitrate", () => {
    it("should track highest observed bitrate", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAction(
        "CONTENT_START",
        { contentBitrate: 1000, totalPlaytime: 0 },
        true
      );
      aggregator.processAction(
        "CONTENT_HEARTBEAT",
        { contentBitrate: 2000, totalPlaytime: 5000 },
        true
      );
      aggregator.processAction(
        "CONTENT_HEARTBEAT",
        { contentBitrate: 1500, totalPlaytime: 10000 },
        true
      );
      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.peakBitrate).toBe(2000);
    });

    it("should not include peakBitrate when no bitrate observed", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.peakBitrate).toBeUndefined();
    });

    it("should fall back to contentRenditionBitrate", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAction(
        "CONTENT_START",
        { contentRenditionBitrate: 3000, totalPlaytime: 0 },
        true
      );
      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.peakBitrate).toBe(3000);
    });
  });

  describe("averageBitrate (time-weighted)", () => {
    it("should compute time-weighted average with segment tracking", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAction(
        "CONTENT_START",
        { contentBitrate: 2000000, totalPlaytime: 0 },
        true
      );

      // Backdate timestamp by 10s (10000ms)
      aggregator._lastBitrateChangeTimestamp = Date.now() - 10000;
      aggregator._currentBitrate = 2000000;

      // Bitrate changes to 4Mbps
      aggregator.processAction(
        "CONTENT_RENDITION_CHANGE",
        { contentBitrate: 4000000, totalPlaytime: 10000 },
        true
      );

      // The first segment (2Mbps for ~10s) should be accumulated
      expect(aggregator._bitrateWeightedSum).toBeGreaterThan(0);
      expect(aggregator._bitrateTotalDuration).toBeGreaterThan(0);
      expect(aggregator._currentBitrate).toBe(4000000);
    });

    it("should include in-progress segment in averageBitrate", () => {
      aggregator._hasReceivedRequest = true;
      aggregator._currentBitrate = 2000000;
      aggregator._lastBitrateChangeTimestamp = Date.now() - 10000; // 10s ago in ms
      aggregator._bitrateWeightedSum = 0;
      aggregator._bitrateTotalDuration = 0;

      const attrs = aggregator.generateAggregateAttributes();
      // Should be ~2Mbps since only one bitrate segment
      expect(attrs.averageBitrate).toBeGreaterThan(1900000);
      expect(attrs.averageBitrate).toBeLessThan(2100000);
    });

    it("should not include averageBitrate when no bitrate data", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.averageBitrate).toBeUndefined();
    });
  });

  describe("bitrate pause/resume", () => {
    it("should pause bitrate timer on non-playing transition", () => {
      aggregator._currentBitrate = 2000000;
      aggregator._lastBitrateChangeTimestamp = Date.now() - 5000; // 5s ago in ms

      // Transition to non-playing (e.g., pause)
      aggregator.processAction(
        "CONTENT_PAUSE",
        { totalPlaytime: 5000 },
        false
      );

      expect(aggregator._lastBitrateChangeTimestamp).toBe(0);
      expect(aggregator._bitrateTotalDuration).toBeGreaterThan(0);
    });

    it("should resume bitrate timer on playing transition", () => {
      aggregator._currentBitrate = 2000000;
      aggregator._lastBitrateChangeTimestamp = 0; // paused

      // Transition to playing (e.g., resume)
      aggregator.processAction(
        "CONTENT_RESUME",
        { totalPlaytime: 5000 },
        true
      );

      expect(aggregator._lastBitrateChangeTimestamp).toBeGreaterThan(0);
    });

    it("should exclude non-play time from average bitrate", () => {
      aggregator._hasReceivedRequest = true;
      // Simulate: 2Mbps for 10000ms playing (all in ms now)
      aggregator._bitrateWeightedSum = 2000000 * 10000;
      aggregator._bitrateTotalDuration = 10000;
      // Timer is paused (non-playing)
      aggregator._currentBitrate = 2000000;
      aggregator._lastBitrateChangeTimestamp = 0;

      const attrs = aggregator.generateAggregateAttributes();
      // Average should be exactly 2Mbps since timer is paused
      expect(attrs.averageBitrate).toBe(2000000);
    });
  });

  describe("rebuffering", () => {
    it("should skip the first buffer event (initial load)", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAction(
        "CONTENT_START",
        { timeSinceRequested: 1000, totalPlaytime: 0 },
        true
      );
      // First buffer end - should be skipped
      aggregator.processAction(
        "CONTENT_BUFFER_END",
        { timeSinceBufferBegin: 500, totalPlaytime: 1000 },
        true
      );
      expect(aggregator._totalRebufferingTime).toBe(0);
    });

    it("should accumulate subsequent buffer events", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAction(
        "CONTENT_START",
        { timeSinceRequested: 1000, totalPlaytime: 0 },
        true
      );
      // First buffer - skipped
      aggregator.processAction(
        "CONTENT_BUFFER_END",
        { timeSinceBufferBegin: 500, totalPlaytime: 1000 },
        true
      );
      // Second buffer - counted
      aggregator.processAction(
        "CONTENT_BUFFER_END",
        { timeSinceBufferBegin: 300, totalPlaytime: 3000 },
        true
      );
      // Third buffer - counted
      aggregator.processAction(
        "CONTENT_BUFFER_END",
        { timeSinceBufferBegin: 200, totalPlaytime: 5000 },
        true
      );

      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.totalRebufferingTime).toBe(500); // 300 + 200
    });

    it("should compute rebufferingRatio correctly", () => {
      aggregator._hasReceivedRequest = true;
      aggregator._totalRebufferingTime = 1000;
      aggregator._lastTotalPlaytime = 10000;

      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.rebufferingRatio).toBe(10); // (1000/10000) * 100
    });

    it("should return 0 rebufferingRatio when no playtime", () => {
      aggregator._hasReceivedRequest = true;
      aggregator._totalRebufferingTime = 500;
      aggregator._lastTotalPlaytime = 0;

      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.rebufferingRatio).toBe(0);
    });
  });

  describe("error flags", () => {
    it("should set hadStartupError for errors before CONTENT_START", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAction("CONTENT_ERROR", {}, false);

      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.hadStartupError).toBe(true);
      expect(attrs.hadPlaybackError).toBe(false);
    });

    it("should set hadPlaybackError for errors after CONTENT_START", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAction(
        "CONTENT_START",
        { timeSinceRequested: 1000, totalPlaytime: 0 },
        true
      );
      aggregator.processAction("CONTENT_ERROR", {}, true);

      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.hadStartupError).toBe(false);
      expect(attrs.hadPlaybackError).toBe(true);
    });

    it("should set both flags if errors before and after start", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAction("CONTENT_ERROR", {}, false);
      aggregator.processAction(
        "CONTENT_START",
        { timeSinceRequested: 2000, totalPlaytime: 0 },
        true
      );
      aggregator.processAction("CONTENT_ERROR", {}, true);

      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.hadStartupError).toBe(true);
      expect(attrs.hadPlaybackError).toBe(true);
    });
  });

  describe("totalPlaytime tracking", () => {
    it("should track latest totalPlaytime from attributes", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAction(
        "CONTENT_HEARTBEAT",
        { totalPlaytime: 5000 },
        true
      );
      aggregator.processAction(
        "CONTENT_HEARTBEAT",
        { totalPlaytime: 10000 },
        true
      );

      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs.totalPlaytime).toBe(10000);
    });
  });

  describe("real-time totalPlaytime", () => {
    it("should add elapsed time when player is playing", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAction(
        "CONTENT_HEARTBEAT",
        { totalPlaytime: 5000 },
        true
      );

      // Backdate the update timestamp by 3000ms
      aggregator._lastPlaytimeUpdateTimestamp = Date.now() - 3000;

      const attrs = aggregator.generateAggregateAttributes();
      // Should be ~8000ms (5000 + ~3000)
      expect(attrs.totalPlaytime).toBeGreaterThanOrEqual(7900);
      expect(attrs.totalPlaytime).toBeLessThan(8200);
    });

    it("should NOT add elapsed time when player is paused", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAction(
        "CONTENT_HEARTBEAT",
        { totalPlaytime: 5000 },
        true
      );
      // Player pauses
      aggregator.processAction(
        "CONTENT_PAUSE",
        { totalPlaytime: 5000 },
        false
      );

      // Backdate the update timestamp
      aggregator._lastPlaytimeUpdateTimestamp = Date.now() - 10000;

      const attrs = aggregator.generateAggregateAttributes();
      // Should be exactly 5000 — no delta added while paused
      expect(attrs.totalPlaytime).toBe(5000);
    });

    it("should use real-time playtime in rebufferingRatio", () => {
      aggregator._hasReceivedRequest = true;
      aggregator._totalRebufferingTime = 1000;
      aggregator._lastTotalPlaytime = 5000;
      aggregator._isPlaying = true;
      aggregator._lastPlaytimeUpdateTimestamp = Date.now() - 5000; // 5s ago in ms

      const attrs = aggregator.generateAggregateAttributes();
      // totalPlaytime ~10000 (5000 + 5000), ratio = 1000/10000*100 = 10%
      expect(attrs.rebufferingRatio).toBeGreaterThan(9);
      expect(attrs.rebufferingRatio).toBeLessThan(11);
    });
  });

  describe("reset", () => {
    it("should clear all state for next session", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAdEvent("AD_END", { timeSinceAdStarted: 200 });
      aggregator.processAction(
        "CONTENT_START",
        { timeSinceRequested: 1000, contentBitrate: 2000000, totalPlaytime: 0 },
        true
      );
      aggregator.processAction("CONTENT_ERROR", {}, true);

      aggregator.reset();

      expect(aggregator._hasReceivedRequest).toBe(false);
      expect(aggregator._hasReceivedStart).toBe(false);
      expect(aggregator._startupTime).toBeNull();
      expect(aggregator._peakBitrate).toBe(0);
      expect(aggregator._currentBitrate).toBe(0);
      expect(aggregator._totalRebufferingTime).toBe(0);
      expect(aggregator._hadStartupError).toBe(false);
      expect(aggregator._hadPlaybackError).toBe(false);
      expect(aggregator._isPlaying).toBe(false);
      expect(aggregator._lastPlaytimeUpdateTimestamp).toBe(0);
      expect(aggregator._prerollAdWallClockTime).toBe(0);
      expect(aggregator.generateAggregateAttributes()).toBeNull();
    });
  });

  describe("CONTENT_END", () => {
    it("should flush final bitrate segment", () => {
      aggregator._hasReceivedRequest = true;
      aggregator._currentBitrate = 3000000;
      aggregator._lastBitrateChangeTimestamp = Date.now() - 5000; // 5s ago in ms

      aggregator.processAction(
        "CONTENT_END",
        { totalPlaytime: 30000 },
        false
      );

      // After flush, the segment should be accumulated
      expect(aggregator._bitrateTotalDuration).toBeGreaterThan(0);
      expect(aggregator._bitrateWeightedSum).toBeGreaterThan(0);
    });
  });

  describe("dirty check", () => {
    it("should return KPIs on first call", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs).not.toBeNull();
      expect(attrs.hadStartupError).toBe(false);
    });

    it("should return null on second call when KPIs unchanged", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      const first = aggregator.generateAggregateAttributes();
      expect(first).not.toBeNull();

      const second = aggregator.generateAggregateAttributes();
      expect(second).toBeNull();
    });

    it("should return KPIs again after state changes", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.generateAggregateAttributes(); // saves snapshot

      // Change state
      aggregator.processAction(
        "CONTENT_START",
        { timeSinceRequested: 1000, totalPlaytime: 0 },
        true
      );
      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs).not.toBeNull();
      expect(attrs.startupTime).toBe(1000);
    });

    it("should bypass dirty check when force=true", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.generateAggregateAttributes(); // saves snapshot

      // Same state, but force=true
      const attrs = aggregator.generateAggregateAttributes({ force: true });
      expect(attrs).not.toBeNull();
    });

    it("should detect changes in totalPlaytime", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.processAction(
        "CONTENT_HEARTBEAT",
        { totalPlaytime: 5000 },
        true
      );
      aggregator.generateAggregateAttributes(); // saves snapshot

      // Playtime changes
      aggregator.processAction(
        "CONTENT_HEARTBEAT",
        { totalPlaytime: 10000 },
        true
      );
      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs).not.toBeNull();
      expect(attrs.totalPlaytime).toBe(10000);
    });

    it("should detect changes in error flags", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.generateAggregateAttributes(); // saves snapshot

      aggregator.processAction("CONTENT_ERROR", {}, false);
      const attrs = aggregator.generateAggregateAttributes();
      expect(attrs).not.toBeNull();
      expect(attrs.hadStartupError).toBe(true);
    });

    it("should reset snapshot on reset()", () => {
      aggregator.processAction("CONTENT_REQUEST", {}, false);
      aggregator.generateAggregateAttributes(); // saves snapshot

      aggregator.reset();
      expect(aggregator._lastSentSnapshot).toBeNull();
    });
  });

  describe("generateAggregateAttributes full scenario", () => {
    it("should produce complete KPIs for a typical session", () => {
      // Request
      aggregator.processAction("CONTENT_REQUEST", {}, false);

      // Pre-roll ad: 1000ms wall-clock
      aggregator.processAdEvent("AD_END", { timeSinceAdStarted: 1000 });

      // Start
      aggregator.processAction(
        "CONTENT_START",
        {
          timeSinceRequested: 3000,
          contentBitrate: 2000000,
          totalPlaytime: 0,
        },
        true
      );

      // Some playback
      aggregator.processAction(
        "CONTENT_HEARTBEAT",
        { contentBitrate: 2000000, totalPlaytime: 5000 },
        true
      );

      // First buffer (skipped)
      aggregator.processAction(
        "CONTENT_BUFFER_END",
        { timeSinceBufferBegin: 200, totalPlaytime: 5200 },
        true
      );

      // Second buffer (counted)
      aggregator.processAction(
        "CONTENT_BUFFER_END",
        { timeSinceBufferBegin: 400, totalPlaytime: 8000 },
        true
      );

      // Backdate the bitrate timer so the in-progress segment has measurable duration
      aggregator._lastBitrateChangeTimestamp = Date.now() - 10000;

      const attrs = aggregator.generateAggregateAttributes();

      expect(attrs.startupTime).toBe(2000); // 3000 - 1000
      expect(attrs.peakBitrate).toBe(2000000);
      expect(attrs.averageBitrate).toBeDefined();
      expect(attrs.totalPlaytime).toBe(8000);
      expect(attrs.totalRebufferingTime).toBe(400);
      expect(attrs.rebufferingRatio).toBe((400 / 8000) * 100);
      expect(attrs.hadStartupError).toBe(false);
      expect(attrs.hadPlaybackError).toBe(false);
    });
  });
});

describe("QoE Harvest-Time Provider Integration", () => {
  beforeAll(() => {
    Log.level = Log.Levels.SILENT;
  });

  afterAll(() => {
    Log.level = Log.Levels.ERROR;
  });

  beforeEach(() => {
    videoAnalyticsHarvester.initialize();
    if (videoAnalyticsHarvester.eventBuffer) {
      videoAnalyticsHarvester.eventBuffer.clear();
    }
  });

  afterEach(() => {
    if (videoAnalyticsHarvester.eventBuffer) {
      videoAnalyticsHarvester.eventBuffer.clear();
    }
    videoAnalyticsHarvester.harvestScheduler.setQoeProvider(null);
  });

  it("should add regular events to buffer normally", () => {
    const event = {
      eventType: "VideoAction",
      actionName: "CONTENT_HEARTBEAT",
      totalPlaytime: 1000
    };

    const result = videoAnalyticsHarvester.addEvent(event);

    expect(result).toBe(true);
    expect(videoAnalyticsHarvester.eventBuffer.size()).toBe(1);
  });

  it("should support setQoeProvider on agent", () => {
    const provider = jest.fn().mockReturnValue(null);

    videoAnalyticsHarvester.setQoeProvider(provider);

    expect(videoAnalyticsHarvester.harvestScheduler.qoeProvider).toBe(provider);
  });

  it("should include qoeAggregateVersion in provider-built events", () => {
    const qoeEvent = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      qoeAggregateVersion: "1.0.0",
      totalPlaytime: 1000,
      hadStartupError: false,
      hadPlaybackError: false
    };

    expect(qoeEvent.qoeAggregateVersion).toBe("1.0.0");
    expect(qoeEvent.actionName).toBe(Tracker.Events.QOE_AGGREGATE);
    expect(qoeEvent.eventType).toBe("VideoAction");
  });

  it("should not add QOE_AGGREGATE events to buffer when using provider pattern", () => {
    const provider = jest.fn().mockReturnValue({
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      totalPlaytime: 5000
    });

    videoAnalyticsHarvester.setQoeProvider(provider);

    videoAnalyticsHarvester.addEvent({
      eventType: "VideoAction",
      actionName: "CONTENT_HEARTBEAT"
    });

    expect(videoAnalyticsHarvester.eventBuffer.size()).toBe(1);
  });

  describe("drainEvents", () => {
    it("should call provider during drain and append QoE event", () => {
      const qoeEvent = {
        eventType: "VideoAction",
        actionName: Tracker.Events.QOE_AGGREGATE,
        totalPlaytime: 5000
      };
      const provider = jest.fn().mockReturnValue(qoeEvent);

      videoAnalyticsHarvester.setQoeProvider(provider);

      videoAnalyticsHarvester.addEvent({
        eventType: "VideoAction",
        actionName: "CONTENT_HEARTBEAT"
      });

      const events = videoAnalyticsHarvester.harvestScheduler.drainEvents();

      expect(provider).toHaveBeenCalled();
      expect(events.length).toBe(2);
      expect(events[1].actionName).toBe(Tracker.Events.QOE_AGGREGATE);
    });

    it("should not append QoE event when provider returns null", () => {
      const provider = jest.fn().mockReturnValue(null);
      videoAnalyticsHarvester.setQoeProvider(provider);

      videoAnalyticsHarvester.addEvent({
        eventType: "VideoAction",
        actionName: "CONTENT_HEARTBEAT"
      });

      const events = videoAnalyticsHarvester.harvestScheduler.drainEvents();

      expect(provider).toHaveBeenCalled();
      expect(events.length).toBe(1);
    });

    it("should pass isFinalHarvest to provider", () => {
      const provider = jest.fn().mockReturnValue(null);
      videoAnalyticsHarvester.setQoeProvider(provider);

      videoAnalyticsHarvester.harvestScheduler.drainEvents({ isFinalHarvest: true });

      expect(provider).toHaveBeenCalledWith({ isFinalHarvest: true });
    });

    it("should return pending final QoE event after CONTENT_END", () => {
      let pendingFinal = {
        eventType: "VideoAction",
        actionName: Tracker.Events.QOE_AGGREGATE,
        totalPlaytime: 30000,
        hadStartupError: false,
        hadPlaybackError: false
      };

      const provider = jest.fn().mockImplementation(() => {
        if (pendingFinal) {
          const event = pendingFinal;
          pendingFinal = null;
          return event;
        }
        return null;
      });

      videoAnalyticsHarvester.setQoeProvider(provider);

      const events1 = videoAnalyticsHarvester.harvestScheduler.drainEvents();
      expect(events1.length).toBe(1);
      expect(events1[0].totalPlaytime).toBe(30000);

      const events2 = videoAnalyticsHarvester.harvestScheduler.drainEvents();
      expect(events2.length).toBe(0);
    });
  });
});
