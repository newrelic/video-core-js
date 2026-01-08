import Tracker from "../src/tracker";
import Log from "../src/log";
import sinon from "sinon";
import { JSDOM } from "jsdom";
import assert from "assert";

describe("Tracker", () => {
  let tracker;

  // Mute console
  beforeAll(() => {
    Log.level = Log.Levels.SILENT;

    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    global.window = dom.window;
    global.document = dom.window.document;
  });

  afterAll(() => {
    Log.level = Log.Levels.ERROR;
  });

  beforeEach(() => {
    // Setup global window with NRVIDEO for agent initialization
    global.window.NRVIDEO = {
      info: {
        appName: "TestApp",
        applicationID: "test-123",
        beacon: "bam.nr-data.net",
        licenseKey: "test-key"
      }
    };
  });

  afterEach(() => {
    delete global.window.NRVIDEO;
  });

  describe("setting", () => {
    it("should unregister listeners when disposing", () => {
      tracker = new Tracker();
      let spy = sinon.spy(tracker, "unregisterListeners");
      tracker.dispose();

      assert(spy.called, "unregisterListeners not called");
      spy.restore();
    });

    it("should call registerListeners method", () => {
      tracker = new Tracker();
      expect(() => tracker.registerListeners()).not.toThrow();
    });

    it("should set options", () => {
      tracker = new Tracker({ customData: { key: "value" } });
      expect(tracker.customData.key).toBe("value");

      tracker.setOptions();
      expect(tracker.customData.key).toBe("value");

      tracker.setOptions({ customData: { key: "value2" } });
      expect(tracker.customData.key).toBe("value2");
    });

    it("should send custom data", (done) => {
      tracker = new Tracker({ customData: { a: 1 } });
      tracker.on("EVENT", (e) => {
        expect(e.data.a).toBe(1);
        done();
      });
      tracker.sendVideoAction("EVENT");
    });

    it("should return attributes", () => {
      tracker = new Tracker();
      let att = tracker.getAttributes();
      expect(att.trackerName).toBeDefined();
      expect(att.trackerVersion).toBeDefined();
      expect(att.coreVersion).toBeDefined();
      expect(att.timeSinceTrackerReady).toBeDefined();
    });

    it("should return tracker name", () => {
      tracker = new Tracker();
      expect(tracker.getTrackerName()).toBe("base-tracker");
    });

    it("should return tracker version", () => {
      tracker = new Tracker();
      const version = tracker.getTrackerVersion();
      expect(version).toBeDefined();
      expect(typeof version).toBe("string");
    });

    it("should not include isBackgroundEvent when document.hidden is undefined", () => {
      tracker = new Tracker();
      const originalDescriptor = Object.getOwnPropertyDescriptor(global.document, 'hidden');

      // Set document.hidden to undefined
      Object.defineProperty(global.document, 'hidden', {
        writable: true,
        configurable: true,
        value: undefined
      });

      let att = tracker.getAttributes();
      expect(att.isBackgroundEvent).toBeUndefined();

      // Restore original descriptor
      if (originalDescriptor) {
        Object.defineProperty(global.document, 'hidden', originalDescriptor);
      }
    });
  });

  describe("setting and getting heartbeat", () => {
    it("should return default heartbeat of 30000", () => {
      tracker = new Tracker();
      // Create a mock state object to avoid undefined error
      tracker.state = { _isAd: false };
      expect(tracker.getHeartbeat()).toBe(30000);
    });

    it("should return parent tracker heartbeat", () => {
      const parent = new Tracker({ heartbeat: 20000 });
      parent.state = { _isAd: false };
      tracker = new Tracker();
      tracker.state = { _isAd: false };
      tracker.setOptions({ parentTracker: parent });
      expect(tracker.getHeartbeat()).toBe(20000);
    });

    it("should return own heartbeat over parent", () => {
      const parent = new Tracker({ heartbeat: 20000 });
      parent.state = { _isAd: false };
      tracker = new Tracker({ heartbeat: 10000 });
      tracker.state = { _isAd: false };
      tracker.setOptions({ parentTracker: parent });
      expect(tracker.getHeartbeat()).toBe(10000);
    });

    it("should return 2000 for ad trackers", () => {
      tracker = new Tracker();
      tracker.state = { _isAd: true };
      expect(tracker.getHeartbeat()).toBe(2000);
    });

    it("should send heartbeat", (done) => {
      tracker.on(Tracker.Events.HEARTBEAT, () => done());
      tracker.sendHeartbeat();
    });
  });

  describe("harvest interval management", () => {
    it("should set harvest interval successfully", () => {
      tracker = new Tracker();
      expect(() => tracker.setHarvestInterval(10000)).not.toThrow();
    });

    it("should handle error when videoAnalyticsHarvester is not available", async () => {
      tracker = new Tracker();
      const logErrorSpy = sinon.spy(Log, "error");

      // Import agent module dynamically
      const agentModule = await import("../src/agent.js");
      const originalHarvester = agentModule.videoAnalyticsHarvester;

      try {
        // Set harvester to null to simulate unavailable state
        agentModule.videoAnalyticsHarvester = null;

        tracker.setHarvestInterval(10000);

        expect(logErrorSpy.called).toBe(true);
        const errorCall = logErrorSpy.getCalls().find(call =>
          call.args[0] && call.args[0].includes("VideoAnalyticsHarvester is not available")
        );
        expect(errorCall).toBeDefined();
      } finally {
        // Always restore
        agentModule.videoAnalyticsHarvester = originalHarvester;
        logErrorSpy.restore();
      }
    });

    it("should start and stop heartbeats", (done) => {
      tracker = new Tracker({ heartbeat: 500 });
      tracker.state = { _isAd: false };
      
      const clock = sinon.useFakeTimers(); // Use fake timers to control the time
      const heartbeatSpy = sinon.spy(tracker, "sendHeartbeat");

      tracker.startHeartbeat();

      // Fast forward time to ensure at least one heartbeat is sent
      clock.tick(5000); 
      
      // Check if sendHeartbeat was called appropriately
      expect(heartbeatSpy.called).toBe(true); 

      // Stop the heartbeat
      tracker.stopHeartbeat();

      // Clear the spy
      heartbeatSpy.restore();
      clock.restore();
      done();
    });

    it("should handle error when setHarvestInterval throws", async () => {
      tracker = new Tracker();
      const logErrorSpy = sinon.spy(Log, "error");

      // Import agent module dynamically
      const agentModule = await import("../src/agent.js");
      const originalMethod = agentModule.videoAnalyticsHarvester.setHarvestInterval;

      try {
        agentModule.videoAnalyticsHarvester.setHarvestInterval = () => {
          throw new Error("Test error");
        };

        tracker.setHarvestInterval(10000);

        expect(logErrorSpy.called).toBe(true);
        const errorCall = logErrorSpy.getCalls().find(call =>
          call.args[0] && call.args[0].includes("Failed to set harvest interval")
        );
        expect(errorCall).toBeDefined();
      } finally {
        // Always restore
        agentModule.videoAnalyticsHarvester.setHarvestInterval = originalMethod;
        logErrorSpy.restore();
      }
    });
  });

});
