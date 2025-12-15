import { recordEvent } from "../src/recordEvent.js";
import { videoAnalyticsHarvester } from "../src/agent.js";
import Constants from "../src/constants.js";
import Log from "../src/log.js";
import Tracker from "../src/tracker.js";
import chai from "chai";
import sinon from "sinon";

const expect = chai.expect;
const assert = chai.assert;

describe("recordEvent", () => {
  let addEventStub;
  let dateNowStub;
  let performanceNowStub;
  let logWarnSpy;
  let logErrorSpy;

  before(() => {
    Log.level = Log.Levels.SILENT;
  });

  after(() => {
    Log.level = Log.Levels.ERROR;
  });

  beforeEach(() => {
    // Setup window mock with NRVIDEO
    performanceNowStub = sinon.stub().returns(5000);
    global.window = {
      NRVIDEO: {
        info: {
          appName: "TestApp",
          applicationID: "test-app-id-12345",
          beacon: "bam.nr-data.net",
          licenseKey: "test-license-key"
        }
      },
      performance: {
        now: performanceNowStub
      },
      location: {
        href: "http://test.com/video"
      }
    };

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
    logWarnSpy.restore();
    logErrorSpy.restore();
    delete global.window;
  });

  describe("validation", () => {
    it("should return false for invalid event type", () => {
      const result = recordEvent("InvalidEventType", { someAttr: "value" });

      expect(result).to.be.false;
      expect(logWarnSpy.calledOnce).to.be.true;
      expect(logWarnSpy.firstCall.args[0]).to.include("Invalid event type");
      expect(addEventStub.called).to.be.false;
    });

    it("should return undefined when window.NRVIDEO.info is missing", () => {
      delete global.window.NRVIDEO;

      const result = recordEvent("VideoAction", { someAttr: "value" });

      expect(result).to.be.undefined;
      expect(addEventStub.called).to.be.false;
    });

    it("should return false when window is undefined due to error handling", () => {
      delete global.window;

      const result = recordEvent("VideoAction", { someAttr: "value" });

      expect(result).to.be.false;
      expect(addEventStub.called).to.be.false;
      expect(logErrorSpy.calledOnce).to.be.true;
    });

    it("should accept valid event type 'VideoAction'", () => {
      const result = recordEvent("VideoAction", {});

      expect(result).to.be.true;
      expect(addEventStub.calledTwice).to.be.true;
    });

    it("should accept valid event type 'VideoAdAction'", () => {
      const result = recordEvent("VideoAdAction", {});

      expect(result).to.be.true;
      expect(addEventStub.calledTwice).to.be.true;
    });

    it("should accept valid event type 'VideoErrorAction'", () => {
      const result = recordEvent("VideoErrorAction", {});

      expect(result).to.be.true;
      expect(addEventStub.calledTwice).to.be.true;
    });

    it("should accept valid event type 'VideoCustomAction'", () => {
      const result = recordEvent("VideoCustomAction", {});

      expect(result).to.be.true;
      expect(addEventStub.calledTwice).to.be.true;
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

      expect(addEventStub.calledTwice).to.be.true;

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject).to.deep.include({
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
      expect(eventObject.timestamp).to.equal(1234567890);
      expect(dateNowStub.calledOnce).to.be.true;
    });

    it("should add timeSinceLoad from performance.now() in seconds", () => {
      recordEvent("VideoAction", {});

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject.timeSinceLoad).to.equal(5); // 5000ms / 1000 = 5s
      expect(performanceNowStub.calledOnce).to.be.true;
    });

    it("should set timeSinceLoad to null when performance is undefined", () => {
      delete global.window.performance;

      recordEvent("VideoAction", {});

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject.timeSinceLoad).to.be.null;
    });

    it("should NOT include appName when applicationID is present", () => {
      recordEvent("VideoAction", { someAttr: "value" });

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject).to.not.have.property("appName");
    });

    it("should include appName when applicationID is missing", () => {
      delete global.window.NRVIDEO.info.applicationID;

      recordEvent("VideoAction", { someAttr: "value" });

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject.appName).to.equal("TestApp");
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

      expect(addEventStub.calledTwice).to.be.true;

      const qoeEventObject = addEventStub.secondCall.args[0];
      expect(qoeEventObject.eventType).to.equal("VideoAction");
      expect(qoeEventObject.actionName).to.equal(Tracker.Events.QOE_AGGREGATE);
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
      expect(qoeEventObject).to.deep.include({
        totalPlaytime: 100,
        totalRebufferTime: 5,
        averageBitrate: 2500000
      });
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
      expect(qoeEventObject.viewId).to.equal("view-123");
      expect(qoeEventObject.playerName).to.equal("TestPlayer");
      expect(qoeEventObject.playerVersion).to.equal("1.0.0");
      expect(qoeEventObject.src).to.equal("http://example.com/video.mp4");
      expect(qoeEventObject.coreVersion).to.equal("2.0.0");
      expect(qoeEventObject).to.not.have.property("otherAttribute");
    });

    it("should add timestamp and timeSinceLoad to QoE event", () => {
      const attributes = {
        qoe: {
          totalPlaytime: 100
        }
      };

      recordEvent("VideoAction", attributes);

      const qoeEventObject = addEventStub.secondCall.args[0];
      expect(qoeEventObject.timestamp).to.equal(1234567890);
      expect(qoeEventObject.timeSinceLoad).to.equal(5);
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
      expect(eventObject).to.not.have.property("qoe");
      expect(eventObject.actionName).to.equal("PLAY");
    });

    it("should create QoE event even when qoe attribute is missing", () => {
      const attributes = {
        actionName: "PLAY"
      };

      recordEvent("VideoAction", attributes);

      expect(addEventStub.calledTwice).to.be.true;
      const qoeEventObject = addEventStub.secondCall.args[0];
      expect(qoeEventObject.eventType).to.equal("VideoAction");
      expect(qoeEventObject.actionName).to.equal(Tracker.Events.QOE_AGGREGATE);
    });
  });

  describe("videoAnalyticsHarvester.addEvent calls", () => {
    it("should call addEvent exactly twice", () => {
      recordEvent("VideoAction", { actionName: "PLAY" });

      expect(addEventStub.calledTwice).to.be.true;
    });

    it("should call addEvent with main event object first", () => {
      const attributes = {
        actionName: "PLAY",
        contentDuration: 120
      };

      recordEvent("VideoAction", attributes);

      const firstCallArgs = addEventStub.firstCall.args[0];
      expect(firstCallArgs).to.deep.include({
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
      expect(secondCallArgs.eventType).to.equal("VideoAction");
      expect(secondCallArgs.actionName).to.equal(Tracker.Events.QOE_AGGREGATE);
      expect(secondCallArgs.totalPlaytime).to.equal(100);
    });

    it("should return true when both addEvent calls succeed", () => {
      addEventStub.returns(true);

      const result = recordEvent("VideoAction", {});

      expect(result).to.be.true;
    });

    it("should return false when first addEvent call fails", () => {
      addEventStub.onFirstCall().returns(false);
      addEventStub.onSecondCall().returns(true);

      const result = recordEvent("VideoAction", {});

      expect(result).to.be.false;
    });

    it("should return false when second addEvent call fails", () => {
      addEventStub.onFirstCall().returns(true);
      addEventStub.onSecondCall().returns(false);

      const result = recordEvent("VideoAction", {});

      expect(result).to.be.false;
    });

    it("should return false when both addEvent calls fail", () => {
      addEventStub.returns(false);

      const result = recordEvent("VideoAction", {});

      expect(result).to.be.false;
    });
  });

  describe("edge cases", () => {
    it("should handle empty attributes object", () => {
      const result = recordEvent("VideoAction", {});

      expect(result).to.be.true;
      expect(addEventStub.calledTwice).to.be.true;

      const eventObject = addEventStub.firstCall.args[0];
      expect(eventObject.eventType).to.equal("VideoAction");
      expect(eventObject.timestamp).to.equal(1234567890);
    });

    it("should handle undefined attributes parameter", () => {
      const result = recordEvent("VideoAction");

      expect(result).to.be.true;
      expect(addEventStub.calledTwice).to.be.true;
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

      expect(eventObject).to.not.have.property("totalPlaytime");
      expect(qoeEventObject.totalPlaytime).to.equal(100);
      expect(qoeEventObject.totalRebufferTime).to.equal(5);
    });

    it("should handle error during execution and return false", () => {
      addEventStub.restore();
      addEventStub = sinon.stub(videoAnalyticsHarvester, "addEvent").throws(new Error("Test error"));

      const result = recordEvent("VideoAction", {});

      expect(result).to.be.false;
      expect(logErrorSpy.calledOnce).to.be.true;
      expect(logErrorSpy.firstCall.args[0]).to.include("Failed to record event");
    });

    it("should handle null qoe attribute", () => {
      const attributes = {
        actionName: "PLAY",
        qoe: null
      };

      const result = recordEvent("VideoAction", attributes);

      expect(result).to.be.true;
      expect(addEventStub.calledTwice).to.be.true;
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
      expect(qoeEventObject.coreVersion).to.equal("2.0.0");
      expect(qoeEventObject["instrumentation.name"]).to.equal("video-tracker");
      expect(qoeEventObject["instrumentation.provider"]).to.equal("newrelic");
      expect(qoeEventObject["instrumentation.version"]).to.equal("1.0.0");
      expect(qoeEventObject.isBackgroundEvent).to.be.false;
      expect(qoeEventObject.playerName).to.equal("TestPlayer");
      expect(qoeEventObject.playerVersion).to.equal("1.0.0");
      expect(qoeEventObject.src).to.equal("http://example.com/video.mp4");
      expect(qoeEventObject.viewId).to.equal("view-123");
      expect(qoeEventObject.viewSession).to.equal("session-456");
      expect(qoeEventObject.contentIsAutoplayed).to.be.true;
      expect(qoeEventObject.totalPlaytime).to.equal(100);
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
      expect(mainEvent.actionName).to.equal("PAUSE");
      expect(mainEvent.contentDuration).to.equal(120);
      expect(mainEvent.playerState).to.equal("paused");
      expect(mainEvent.viewId).to.equal("view-789");
      expect(mainEvent.playerName).to.equal("CustomPlayer");
      expect(mainEvent).to.not.have.property("totalPlaytime");
      expect(mainEvent).to.not.have.property("totalRebufferTime");
      expect(mainEvent).to.not.have.property("averageBitrate");

      // QoE event should have qoe attributes and metadata keys
      expect(qoeEvent.totalPlaytime).to.equal(50);
      expect(qoeEvent.totalRebufferTime).to.equal(2);
      expect(qoeEvent.averageBitrate).to.equal(2500000);
      expect(qoeEvent.viewId).to.equal("view-789");
      expect(qoeEvent.playerName).to.equal("CustomPlayer");
      expect(qoeEvent.actionName).to.equal(Tracker.Events.QOE_AGGREGATE);
      expect(qoeEvent).to.not.have.property("contentDuration");
      expect(qoeEvent).to.not.have.property("playerState");
    });

    it("should maintain correct actionName values for both events", () => {
      const attributes = {
        actionName: "BUFFER_START"
      };

      recordEvent("VideoAction", attributes);

      const mainEvent = addEventStub.firstCall.args[0];
      const qoeEvent = addEventStub.secondCall.args[0];

      expect(mainEvent.actionName).to.equal("BUFFER_START");
      expect(qoeEvent.actionName).to.equal(Tracker.Events.QOE_AGGREGATE);
    });
  });
});
