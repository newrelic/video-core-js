import { recordEvent } from "../src/recordEvent.js";
import { videoAnalyticsHarvester } from "../src/agent.js";
import Constants from "../src/constants.js";
import Log from "../src/log.js";
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
      expect(addEventStub.calledOnce).toBe(true);
    });

    it("should accept valid event type 'VideoAdAction'", () => {
      const result = recordEvent("VideoAdAction", {});

      expect(result).toBe(true);
      expect(addEventStub.calledOnce).toBe(true);
    });

    it("should accept valid event type 'VideoErrorAction'", () => {
      const result = recordEvent("VideoErrorAction", {});

      expect(result).toBe(true);
      expect(addEventStub.calledOnce).toBe(true);
    });

    it("should accept valid event type 'VideoCustomAction'", () => {
      const result = recordEvent("VideoCustomAction", {});

      expect(result).toBe(true);
      expect(addEventStub.calledOnce).toBe(true);
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

      expect(addEventStub.calledOnce).toBe(true);

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

  describe("videoAnalyticsHarvester.addEvent calls", () => {
    it("should call addEvent exactly once per recordEvent call", () => {
      recordEvent("VideoAction", { actionName: "PLAY" });

      expect(addEventStub.calledOnce).toBe(true);
    });

    it("should call addEvent with correct event object", () => {
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

    it("should return true when addEvent succeeds", () => {
      addEventStub.returns(true);

      const result = recordEvent("VideoAction", {});

      expect(result).toBe(true);
    });

    it("should return false when addEvent fails", () => {
      addEventStub.returns(false);

      const result = recordEvent("VideoAction", {});

      expect(result).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty attributes object", () => {
      const result = recordEvent("VideoAction", {});

      expect(result).toBe(true);
      expect(addEventStub.calledOnce).toBe(true);

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject.eventType).toBe("VideoAction");
      expect(eventObject.timestamp).toBe(1234567890);
    });

    it("should handle undefined attributes parameter", () => {
      const result = recordEvent("VideoAction");

      expect(result).toBe(true);
      expect(addEventStub.calledOnce).toBe(true);
    });

    it("should handle error during execution and return false", () => {
      addEventStub.restore();
      addEventStub = sinon.stub(videoAnalyticsHarvester, "addEvent").throws(new Error("Test error"));

      const result = recordEvent("VideoAction", {});

      expect(result).toBe(false);
      expect(logErrorSpy.calledOnce).toBe(true);
      expect(logErrorSpy.firstCall.args[0]).toContain("Failed to record event");
    });
  });
});
