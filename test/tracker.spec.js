import Tracker from "../src/tracker";
import Log from "../src/log";
import chai from "chai";
import sinon from "sinon";

const expect = chai.expect;
const assert = chai.assert;

describe("Tracker", () => {
  let tracker;
  global.document =
    typeof global.document === "undefined" ? {} : global.document;

  // Mute console
  before(() => {
    Log.level = Log.Levels.SILENT;
  });

  after(() => {
    Log.level = Log.Levels.ERROR;
  });

  describe("setting", () => {
    it("should unregister listeners when disposing", () => {
      tracker = new Tracker();
      let spy = sinon.spy(tracker, "unregisterListeners");
      tracker.dispose();

      assert(spy.called, "unregisterListeners not called");
      spy.restore();
    });

    it("should set options", () => {
      // construct
      tracker = new Tracker({ customData: { key: "value" } });
      expect(tracker.customData.key).to.equal("value");

      // no change
      tracker.setOptions();
      expect(tracker.customData.key).to.equal("value");

      // change
      tracker.setOptions({ customData: { key: "value2" } });
      expect(tracker.customData.key).to.equal("value2");
    });

    it("should send custom data", (done) => {
      tracker = new Tracker({ customData: { a: 1 } });
      tracker.on("EVENT", (e) => {
        expect(e.data.a).to.equal(1);
        done();
      });
      tracker.sendVideoAction("EVENT");
    });

    it("should return attributes", () => {
      tracker = new Tracker();
      let att = tracker.getAttributes();
      expect(att.trackerName).to.not.be.undefined;
      expect(att.trackerVersion).to.not.be.undefined;
      expect(att.coreVersion).to.not.be.undefined;
      expect(att.timeSinceTrackerReady).to.not.be.undefined;
    });
  });

  describe("setting and getting heartbeat", () => {
    it("should return heartbeat", () => {
      tracker = new Tracker();
      expect(tracker.getHeartbeat()).to.equal(30000);

      tracker.setOptions({ parentTracker: new Tracker({ heartbeat: 20000 }) });
      expect(tracker.getHeartbeat()).to.equal(20000);

      tracker.setOptions({ heartbeat: 10000 });
      expect(tracker.getHeartbeat()).to.equal(10000);
    });

    it("should send heartbeat", (done) => {
      tracker.on(Tracker.Events.HEARTBEAT, () => done());
      tracker.sendHeartbeat();
    });
  });

  describe("Tracker heartbeating", () => {
    let tracker;
    let clock;

    beforeEach(() => {
      tracker = new Tracker({ heartbeat: 500 });
      clock = sinon.useFakeTimers(); // Use fake timers to control the time
    });

    afterEach(() => {
      clock.restore(); // Restore the original timers
    });

    it("should start and stop heartbeats", (done) => {
      const heartbeatSpy = sinon.spy(tracker, "sendHeartbeat");

      tracker.startHeartbeat();

      // Fast forward time to ensure at least one heartbeat is sent
      clock.tick(5000); // The heartbeat interval has a minimum of 5000ms, as per your code comments

      // Check if sendHeartbeat was called appropriately
      expect(heartbeatSpy.called).to.be.true;

      // Stop the heartbeat
      tracker.stopHeartbeat();

      // Clear the spy
      heartbeatSpy.restore();
      done();
    });
  });
});
