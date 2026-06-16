import { recordEvent } from "../src/recordEvent.js";
import { videoAnalyticsHarvester } from "../src/browser/agent.js";
import Constants from "../src/constants.js";
import Log from "../src/log.js";
import Tracker from "../src/tracker.js";
import sinon from "sinon";
import { JSDOM } from "jsdom";

describe("recordEvent", () => {
  let addEventStub;
  let dateNowStub;
  let performanceNowStub;
  let logWarnSpy;
  let logErrorSpy;

  beforeAll(() => {
    Log.level = Log.Levels.SILENT;

    // Setup JSDOM environment
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    global.window = dom.window;
    global.document = dom.window.document;

    // Initialize agent
    if (!videoAnalyticsHarvester.isInitialized) {
      videoAnalyticsHarvester.initialize();
    }
  });

  afterAll(() => {
    Log.level = Log.Levels.ERROR;

    // Stop scheduler
    if (videoAnalyticsHarvester.harvestScheduler) {
      videoAnalyticsHarvester.harvestScheduler.stopScheduler();
    }
  });

  beforeEach(() => {
    // Setup window mock with NRVIDEO
    global.window.NRVIDEO = {
      info: {
        appName: "TestApp",
        applicationID: "test-app-id-12345",
        beacon: "bam.nr-data.net",
        licenseKey: "test-license-key"
      },
      config: {
        qoeAggregate: true
      }
    };

    // Ensure window.performance exists (in case previous test deleted it)
    if (!global.window.performance) {
      global.window.performance = {
        now: () => 0
      };
    }

    // Stub performance.now() on the existing window.performance object
    if (global.window.performance && global.window.performance.now) {
      performanceNowStub = sinon.stub(global.window.performance, "now").returns(5000);
    }

    // Stub harvester addEvent
    addEventStub = sinon.stub(videoAnalyticsHarvester, "addEvent").returns(true);

    // Stub Date.now for predictable timestamps
    dateNowStub = sinon.stub(Date, "now").returns(1234567890);

    // Spy on Log methods
    logWarnSpy = sinon.spy(Log, "warn");
    logErrorSpy = sinon.spy(Log, "error");
  });

  afterEach(() => {
    addEventStub.restore();
    dateNowStub.restore();
    if (performanceNowStub && performanceNowStub.restore) {
      performanceNowStub.restore();
    }
    logWarnSpy.restore();
    logErrorSpy.restore();
    delete global.window;
  });

  describe("validation", () => {
    it("should return false for invalid event type", () => {
      const result = recordEvent("InvalidEventType", { someAttr: "value" });

      expect(result).toBe(false);
      expect(logWarnSpy.calledOnce).toBe(true);
      expect(logWarnSpy.firstCall.args[0]).toContain("Invalid event type");
      expect(addEventStub.called).toBe(false);
    });

    it("should return undefined when window.NRVIDEO.info is missing", () => {
      delete global.window.NRVIDEO;

      const result = recordEvent("VideoAction", { someAttr: "value" });

      expect(result).toBeUndefined();
      expect(addEventStub.called).toBe(false);
    });

    it("should return false when window is undefined due to error handling", () => {
      delete global.window.NRVIDEO;

      const result = recordEvent("VideoAction", { someAttr: "value" });

      expect(result).toBe(undefined);
      expect(addEventStub.called).toBe(false);
    });

    it("should accept valid event type 'VideoAction'", () => {
      const result = recordEvent("VideoAction", {});

      expect(result).toBe(true);
      expect(addEventStub.calledTwice).toBe(true);
    });

    it("should accept valid event type 'VideoAdAction'", () => {
      const result = recordEvent("VideoAdAction", {});

      expect(result).toBe(true);
      expect(addEventStub.calledTwice).toBe(false);
    });

    it("should accept valid event type 'VideoErrorAction'", () => {
      const result = recordEvent("VideoErrorAction", {});

      expect(result).toBe(true);
      expect(addEventStub.calledTwice).toBe(false);
    });

    it("should accept valid event type 'VideoCustomAction'", () => {
      const result = recordEvent("VideoCustomAction", {});

      expect(result).toBe(true);
      expect(addEventStub.calledTwice).toBe(false);
    });
  });

  describe("event object creation", () => {
    it("should create event object with correct structure", () => {
      const attributes = {
        actionName: "PLAY",
        contentDuration: 120,
        contentSrc: "http://example.com/video.mp4"
      };

      recordEvent("VideoAction", attributes);

      expect(addEventStub.calledTwice).toBe(true);

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject).toMatchObject({
        eventType: "VideoAction",
        actionName: "PLAY",
        contentDuration: 120,
        contentSrc: "http://example.com/video.mp4",
        timestamp: 1234567890,
        timeSinceLoad: 5
      });
    });

    it("should add timestamp from Date.now()", () => {
      recordEvent("VideoAction", {});

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject.timestamp).toBe(1234567890);
      expect(dateNowStub.calledOnce).toBe(true);
    });

    it("should add timeSinceLoad from performance.now() in seconds", () => {
      recordEvent("VideoAction", {});

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject.timeSinceLoad).toBe(5); // 5000ms / 1000 = 5s
      expect(performanceNowStub.calledOnce).toBe(true);
    });

    it("should set timeSinceLoad to null when performance is undefined", () => {
      delete global.window.performance;

      recordEvent("VideoAction", {});

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject.timeSinceLoad).toBeNull();
    });

    it("should NOT include appName when applicationID is present", () => {
      recordEvent("VideoAction", { someAttr: "value" });

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject).not.toHaveProperty("appName");
    });

    it("should include appName when applicationID is missing", () => {
      delete global.window.NRVIDEO.info.applicationID;

      recordEvent("VideoAction", { someAttr: "value" });

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject.appName).toBe("TestApp");
    });
  });

  describe("QoE event object creation", () => {
    it("should create QoE event object with correct eventType and actionName", () => {
      const attributes = {
        qoe: {
          totalPlaytime: 100,
          totalRebufferTime: 5
        }
      };

      recordEvent("VideoAction", attributes);

      expect(addEventStub.calledTwice).toBe(true);

      const qoeEventObject = addEventStub.secondCall.args[0];
      expect(qoeEventObject.eventType).toBe("VideoAction");
      expect(qoeEventObject.actionName).toBe(Tracker.Events.QOE_AGGREGATE);
    });

    it("should include qoe attributes in QoE event object", () => {
      const attributes = {
        qoe: {
          totalPlaytime: 100,
          totalRebufferTime: 5,
          averageBitrate: 2500000
        }
      };

      recordEvent("VideoAction", attributes);

      const qoeEventObject = addEventStub.secondCall.args[0];
      expect(qoeEventObject).toMatchObject({
        totalPlaytime: 100,
        totalRebufferTime: 5,
        averageBitrate: 2500000
      });
      expect(qoeEventObject.qoeAggregateVersion).toBe("1.0.0");
    });

    it("should include metadata attributes from VIEW_QOE_AGGREGATE_KEYS in QoE event", () => {
      const attributes = {
        viewId: "view-123",
        playerName: "TestPlayer",
        playerVersion: "1.0.0",
        src: "http://example.com/video.mp4",
        coreVersion: "2.0.0",
        otherAttribute: "should-not-be-in-qoe"
      };

      recordEvent("VideoAction", attributes);

      const qoeEventObject = addEventStub.secondCall.args[0];
      expect(qoeEventObject.viewId).toBe("view-123");
      expect(qoeEventObject.playerName).toBe("TestPlayer");
      expect(qoeEventObject.playerVersion).toBe("1.0.0");
      expect(qoeEventObject.src).toBe("http://example.com/video.mp4");
      expect(qoeEventObject.coreVersion).toBe("2.0.0");
      expect(qoeEventObject).not.toHaveProperty("otherAttribute");
    });

    it("should add timestamp and timeSinceLoad to QoE event", () => {
      const attributes = {
        qoe: {
          totalPlaytime: 100
        }
      };

      recordEvent("VideoAction", attributes);

      const qoeEventObject = addEventStub.secondCall.args[0];
      expect(qoeEventObject.timestamp).toBe(1234567890);
      expect(qoeEventObject.timeSinceLoad).toBe(5);
    });

    it("should NOT include qoe property in main event object", () => {
      const attributes = {
        actionName: "PLAY",
        qoe: {
          totalPlaytime: 100
        }
      };

      recordEvent("VideoAction", attributes);

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject).not.toHaveProperty("qoe");
      expect(eventObject.actionName).toBe("PLAY");
    });

    it("should create QoE event even when qoe attribute is missing", () => {
      const attributes = {
        actionName: "PLAY"
      };

      recordEvent("VideoAction", attributes);

      expect(addEventStub.calledTwice).toBe(true);
      const qoeEventObject = addEventStub.secondCall.args[0];
      expect(qoeEventObject.eventType).toBe("VideoAction");
      expect(qoeEventObject.actionName).toBe(Tracker.Events.QOE_AGGREGATE);
    });
  });

  describe("videoAnalyticsHarvester.addEvent calls", () => {
    it("should call addEvent exactly twice", () => {
      recordEvent("VideoAction", { actionName: "PLAY" });

      expect(addEventStub.calledTwice).toBe(true);
    });

    it("should call addEvent with main event object first", () => {
      const attributes = {
        actionName: "PLAY",
        contentDuration: 120
      };

      recordEvent("VideoAction", attributes);

      const firstCallArgs = addEventStub.firstCall.args[0];
      expect(firstCallArgs).toMatchObject({
        eventType: "VideoAction",
        actionName: "PLAY",
        contentDuration: 120
      });
    });

    it("should call addEvent with QoE event object second", () => {
      const attributes = {
        qoe: {
          totalPlaytime: 100
        }
      };

      recordEvent("VideoAction", attributes);

      const secondCallArgs = addEventStub.secondCall.args[0];
      expect(secondCallArgs.eventType).toBe("VideoAction");
      expect(secondCallArgs.actionName).toBe(Tracker.Events.QOE_AGGREGATE);
      expect(secondCallArgs.totalPlaytime).toBe(100);
    });

    it("should return true when both addEvent calls succeed", () => {
      addEventStub.returns(true);

      const result = recordEvent("VideoAction", {});

      expect(result).toBe(true);
    });

    it("should return false when first addEvent call fails", () => {
      addEventStub.onFirstCall().returns(false);
      addEventStub.onSecondCall().returns(true);

      const result = recordEvent("VideoAction", {});

      expect(result).toBe(false);
    });

    it("should return false when second addEvent call fails", () => {
      addEventStub.onFirstCall().returns(true);
      addEventStub.onSecondCall().returns(false);

      const result = recordEvent("VideoAction", {});

      expect(result).toBe(false);
    });

    it("should return false when both addEvent calls fail", () => {
      addEventStub.returns(false);

      const result = recordEvent("VideoAction", {});

      expect(result).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty attributes object", () => {
      const result = recordEvent("VideoAction", {});

      expect(result).toBe(true);
      expect(addEventStub.calledTwice).toBe(true);

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject.eventType).toBe("VideoAction");
      expect(eventObject.timestamp).toBe(1234567890);
    });

    it("should handle undefined attributes parameter", () => {
      const result = recordEvent("VideoAction");

      expect(result).toBe(true);
      expect(addEventStub.calledTwice).toBe(true);
    });

    it("should handle attributes with only qoe property", () => {
      const attributes = {
        qoe: {
          totalPlaytime: 100,
          totalRebufferTime: 5
        }
      };

      recordEvent("VideoAction", attributes);

      const eventObject = addEventStub.firstCall.args[0];
      const qoeEventObject = addEventStub.secondCall.args[0];

      expect(eventObject).not.toHaveProperty("totalPlaytime");
      expect(qoeEventObject.totalPlaytime).toBe(100);
      expect(qoeEventObject.totalRebufferTime).toBe(5);
    });

    it("should handle error during execution and return false", () => {
      addEventStub.restore();
      addEventStub = sinon.stub(videoAnalyticsHarvester, "addEvent").throws(new Error("Test error"));

      const result = recordEvent("VideoAction", {});

      expect(result).toBe(false);
      expect(logErrorSpy.calledOnce).toBe(true);
      expect(logErrorSpy.firstCall.args[0]).toContain("Failed to record event");
    });

    it("should handle null qoe attribute", () => {
      const attributes = {
        actionName: "PLAY",
        qoe: null
      };

      const result = recordEvent("VideoAction", attributes);

      expect(result).toBe(true);
      expect(addEventStub.calledTwice).toBe(true);
    });

    it("should handle attributes with all VIEW_QOE_AGGREGATE_KEYS", () => {
      const attributes = {
        coreVersion: "2.0.0",
        "instrumentation.name": "video-tracker",
        "instrumentation.provider": "newrelic",
        "instrumentation.version": "1.0.0",
        isBackgroundEvent: false,
        playerName: "TestPlayer",
        playerVersion: "1.0.0",
        src: "http://example.com/video.mp4",
        viewId: "view-123",
        viewSession: "session-456",
        contentIsAutoplayed: true,
        qoe: {
          totalPlaytime: 100
        }
      };

      recordEvent("VideoAction", attributes);

      const qoeEventObject = addEventStub.secondCall.args[0];
      expect(qoeEventObject.coreVersion).toBe("2.0.0");
      expect(qoeEventObject["instrumentation.name"]).toBe("video-tracker");
      expect(qoeEventObject["instrumentation.provider"]).toBe("newrelic");
      expect(qoeEventObject["instrumentation.version"]).toBe("1.0.0");
      expect(qoeEventObject.isBackgroundEvent).toBe(false);
      expect(qoeEventObject.playerName).toBe("TestPlayer");
      expect(qoeEventObject.playerVersion).toBe("1.0.0");
      expect(qoeEventObject.src).toBe("http://example.com/video.mp4");
      expect(qoeEventObject.viewId).toBe("view-123");
      expect(qoeEventObject.viewSession).toBe("session-456");
      expect(qoeEventObject.contentIsAutoplayed).toBe(true);
      expect(qoeEventObject.totalPlaytime).toBe(100);
    });
  });

  describe("qoeAggregate config flag", () => {
    it("should send QoE event when qoeAggregate is true", () => {
      global.window.NRVIDEO.config = { qoeAggregate: true };

      const result = recordEvent("VideoAction", { actionName: "PLAY" });

      expect(result).toBe(true);
      expect(addEventStub.calledTwice).toBe(true);

      const qoeEventObject = addEventStub.secondCall.args[0];
      expect(qoeEventObject.actionName).toBe(Tracker.Events.QOE_AGGREGATE);
    });

    it("should NOT send QoE event when qoeAggregate is false", () => {
      global.window.NRVIDEO.config = { qoeAggregate: false };

      const result = recordEvent("VideoAction", { actionName: "PLAY" });

      expect(result).toBe(true);
      expect(addEventStub.calledOnce).toBe(true);
      expect(addEventStub.calledTwice).toBe(false);
    });

    it("should NOT send QoE event when config is undefined", () => {
      delete global.window.NRVIDEO.config;

      const result = recordEvent("VideoAction", { actionName: "PLAY" });

      expect(result).toBe(true);
      expect(addEventStub.calledOnce).toBe(true);
      expect(addEventStub.calledTwice).toBe(false);
    });

    it("should NOT send QoE event when config.qoeAggregate is undefined", () => {
      global.window.NRVIDEO.config = {};

      const result = recordEvent("VideoAction", { actionName: "PLAY" });

      expect(result).toBe(true);
      expect(addEventStub.calledOnce).toBe(true);
      expect(addEventStub.calledTwice).toBe(false);
    });

    it("should handle null config gracefully", () => {
      global.window.NRVIDEO.config = null;

      const result = recordEvent("VideoAction", { actionName: "PLAY" });

      expect(result).toBe(true);
      expect(addEventStub.calledOnce).toBe(true);
      expect(addEventStub.calledTwice).toBe(false);
    });

    it("should only send QoE event for VideoAction event type when qoeAggregate is true", () => {
      global.window.NRVIDEO.config = { qoeAggregate: true };

      recordEvent("VideoAdAction", { actionName: "AD_PLAY" });

      expect(addEventStub.calledOnce).toBe(true);
      expect(addEventStub.calledTwice).toBe(false);
    });

    it("should return false when main event succeeds but QoE event fails", () => {
      global.window.NRVIDEO.config = { qoeAggregate: true };
      addEventStub.onFirstCall().returns(true);
      addEventStub.onSecondCall().returns(false);

      const result = recordEvent("VideoAction", { actionName: "PLAY" });

      expect(result).toBe(false);
      expect(addEventStub.calledTwice).toBe(true);
    });
  });

  describe("complex scenarios", () => {
    it("should separate qoe attributes from main event attributes correctly", () => {
      const attributes = {
        actionName: "PAUSE",
        contentDuration: 120,
        playerState: "paused",
        qoe: {
          totalPlaytime: 50,
          totalRebufferTime: 2,
          averageBitrate: 2500000
        },
        viewId: "view-789",
        playerName: "CustomPlayer"
      };

      recordEvent("VideoAction", attributes);

      const mainEvent = addEventStub.firstCall.args[0];
      const qoeEvent = addEventStub.secondCall.args[0];

      // Main event should have regular attributes but NOT qoe attributes
      expect(mainEvent.actionName).toBe("PAUSE");
      expect(mainEvent.contentDuration).toBe(120);
      expect(mainEvent.playerState).toBe("paused");
      expect(mainEvent.viewId).toBe("view-789");
      expect(mainEvent.playerName).toBe("CustomPlayer");
      expect(mainEvent).not.toHaveProperty("totalPlaytime");
      expect(mainEvent).not.toHaveProperty("totalRebufferTime");
      expect(mainEvent).not.toHaveProperty("averageBitrate");

      // QoE event should have qoe attributes and metadata keys
      expect(qoeEvent.totalPlaytime).toBe(50);
      expect(qoeEvent.totalRebufferTime).toBe(2);
      expect(qoeEvent.averageBitrate).toBe(2500000);
      expect(qoeEvent.viewId).toBe("view-789");
      expect(qoeEvent.playerName).toBe("CustomPlayer");
      expect(qoeEvent.actionName).toBe(Tracker.Events.QOE_AGGREGATE);
      expect(qoeEvent.contentDuration).toBe(120);
      expect(qoeEvent).toHaveProperty("contentDuration");
      expect(qoeEvent).not.toHaveProperty("playerState");
    });

    it("should maintain correct actionName values for both events", () => {
      const attributes = {
        actionName: "BUFFER_START"
      };

      recordEvent("VideoAction", attributes);

      const mainEvent = addEventStub.firstCall.args[0];
      const qoeEvent = addEventStub.secondCall.args[0];

      expect(mainEvent.actionName).toBe("BUFFER_START");
      expect(qoeEvent.actionName).toBe(Tracker.Events.QOE_AGGREGATE);
    });
  });
});
