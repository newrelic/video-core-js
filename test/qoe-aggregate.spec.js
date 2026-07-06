import { videoAnalyticsHarvester } from "../src/browser/agent.js";
import Tracker from "../src/tracker.js";
import Log from "../src/log.js";


describe("QOE_AGGREGATE Buffer Management", () => {
  beforeAll(() => {
    Log.level = Log.Levels.SILENT;
  });

  afterAll(() => {
    Log.level = Log.Levels.ERROR;
  });

  beforeEach(() => {
    // Initialize agent and clear buffer before each test
    videoAnalyticsHarvester.initialize();
    if (videoAnalyticsHarvester.eventBuffer) {
      videoAnalyticsHarvester.eventBuffer.clear();
    }
  });

  afterEach(() => {
    // Clean up after each test
    if (videoAnalyticsHarvester.eventBuffer) {
      videoAnalyticsHarvester.eventBuffer.clear();
    }
  });

  it("should add QOE_AGGREGATE to buffer on first event", () => {
    const qoeEvent = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      qoeAggregateVersion: "1.0.0",
      "kpi.totalPlaytime": 1000,
      "kpi.hadStartupError": false,
      "kpi.hadPlaybackError": false
    };

    const result = videoAnalyticsHarvester.addEvent(qoeEvent);

    expect(result).toBe(true);
    expect(videoAnalyticsHarvester.eventBuffer.size()).toBe(1);

    const events = videoAnalyticsHarvester.eventBuffer.drain();
    expect(events.length).toBe(1);
    expect(events[0].actionName).toBe(Tracker.Events.QOE_AGGREGATE);
  });

  it("should maintain only ONE QOE_AGGREGATE event in buffer at any time", () => {
    const qoeEvent1 = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      totalPlaytime: 1000
    };

    const qoeEvent2 = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      totalPlaytime: 2000
    };

    const qoeEvent3 = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      totalPlaytime: 3000
    };

    // Add multiple QOE events (each has different KPIs so dirty check allows replace)
    videoAnalyticsHarvester.addEvent(qoeEvent1);
    videoAnalyticsHarvester.addEvent(qoeEvent2);
    videoAnalyticsHarvester.addEvent(qoeEvent3);

    // Should still only have 1 event
    expect(videoAnalyticsHarvester.eventBuffer.size()).toBe(1);

    const events = videoAnalyticsHarvester.eventBuffer.drain();
    expect(events.length).toBe(1);
    expect(events[0].totalPlaytime).toBe(3000); // Latest value
  });

  it("should correctly adjust payload size when replacing QOE_AGGREGATE", () => {
    const smallQoeEvent = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      totalPlaytime: 1000
    };

    const largeQoeEvent = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      totalPlaytime: 2000,
      peakBitrate: 2000,
      averageBitrate: 1800,
      totalRebufferingTime: 500,
      rebufferingRatio: 5.5,
      hadStartupError: false,
      hadPlaybackError: true,
      startupTime: 300
    };

    // Add small event
    videoAnalyticsHarvester.addEvent(smallQoeEvent);
    const sizeAfterSmall = videoAnalyticsHarvester.eventBuffer.currentPayloadSize;

    // Replace with large event
    videoAnalyticsHarvester.addEvent(largeQoeEvent);
    const sizeAfterLarge = videoAnalyticsHarvester.eventBuffer.currentPayloadSize;

    // Payload size should increase since we replaced with a larger event
    expect(sizeAfterLarge).toBeGreaterThan(sizeAfterSmall);

    // Verify event count remains 1
    expect(videoAnalyticsHarvester.eventBuffer.size()).toBe(1);
  });

  it("should include qoeAggregateVersion in all QOE_AGGREGATE events", () => {
    const qoeEvent1 = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      qoeAggregateVersion: "1.0.0",
      "kpi.totalPlaytime": 1000
    };

    const qoeEvent2 = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      qoeAggregateVersion: "1.0.0",
      "kpi.totalPlaytime": 2000,
      "kpi.peakBitrate": 2000
    };

    // Add first event and verify qoeAggregateVersion
    videoAnalyticsHarvester.addEvent(qoeEvent1);
    let events = videoAnalyticsHarvester.eventBuffer.drain();
    expect(events.length).toBe(1);
    expect(events[0].qoeAggregateVersion).toBe("1.0.0");

    // Add second event to replace and verify qoeAggregateVersion still present
    videoAnalyticsHarvester.addEvent(qoeEvent2);
    events = videoAnalyticsHarvester.eventBuffer.drain();
    expect(events.length).toBe(1);
    expect(events[0].qoeAggregateVersion).toBe("1.0.0");
    expect(events[0]["kpi.totalPlaytime"]).toBe(2000);
  });

  it("should not increment event count when replacing QOE_AGGREGATE", () => {
    const qoeEvent1 = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      totalPlaytime: 1000
    };

    const qoeEvent2 = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      totalPlaytime: 2000
    };

    const qoeEvent3 = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      totalPlaytime: 3000
    };

    videoAnalyticsHarvester.addEvent(qoeEvent1);
    expect(videoAnalyticsHarvester.eventBuffer.totalEvents).toBe(1);

    videoAnalyticsHarvester.addEvent(qoeEvent2);
    expect(videoAnalyticsHarvester.eventBuffer.totalEvents).toBe(1);

    videoAnalyticsHarvester.addEvent(qoeEvent3);
    expect(videoAnalyticsHarvester.eventBuffer.totalEvents).toBe(1);
  });

  it("should always replace QOE_AGGREGATE in buffer (dedup happens at drain time in scheduler)", () => {
    const qoeEvent1 = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      totalPlaytime: 5000,
      peakBitrate: 2000,
      averageBitrate: 1500,
      timestamp: 1000
    };

    const qoeEvent2 = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      totalPlaytime: 5000,
      peakBitrate: 2000,
      averageBitrate: 1500,
      timestamp: 2000
    };

    videoAnalyticsHarvester.addEvent(qoeEvent1);
    expect(videoAnalyticsHarvester.eventBuffer.size()).toBe(1);

    // Same KPIs, different timestamp — should replace (agent no longer does dirty check)
    videoAnalyticsHarvester.addEvent(qoeEvent2);
    expect(videoAnalyticsHarvester.eventBuffer.size()).toBe(1);

    const events = videoAnalyticsHarvester.eventBuffer.drain();
    // Should have the latest timestamp (replaced)
    expect(events[0].timestamp).toBe(2000);
  });

  it("should replace QOE_AGGREGATE when KPIs change", () => {
    const qoeEvent1 = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      totalPlaytime: 5000,
      peakBitrate: 2000
    };

    const qoeEvent2 = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      totalPlaytime: 8000,
      peakBitrate: 3000
    };

    videoAnalyticsHarvester.addEvent(qoeEvent1);
    videoAnalyticsHarvester.addEvent(qoeEvent2);

    expect(videoAnalyticsHarvester.eventBuffer.size()).toBe(1);
    const events = videoAnalyticsHarvester.eventBuffer.drain();
    expect(events[0].totalPlaytime).toBe(8000);
    expect(events[0].peakBitrate).toBe(3000);
  });

});
