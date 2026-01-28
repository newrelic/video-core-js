import VideoTracker from "../src/videotracker";
import Log from "../src/log";
import chai from "chai";
import sinon from "sinon";
import { JSDOM } from "jsdom";

const expect = chai.expect;
const assert = chai.assert;

describe("VideoTracker", () => {
  let tracker;

  // Mute console
  before(() => {
    Log.level = Log.Levels.SILENT;
  });

  after(() => {
    Log.level = Log.Levels.ERROR;
  });

  describe("viewId", () => {
    let tracker;

    before(() => {
      // Setup jsdom environment
      const dom = new JSDOM("<!doctype html><html><body></body></html>");
      global.window = dom.window;
      global.document = dom.window.document;
    });

    after(() => {
      delete global.window;
      delete global.document;
    });

    it("should be incremented after sendEnd", () => {
      tracker = new VideoTracker(1);

      tracker.sendCustom("test");

      expect(tracker.getViewId().slice(-1)).to.be.equal("0");

      tracker.sendRequest();
      expect(tracker.getViewId().slice(-1)).to.be.equal("0");

      tracker.sendStart();
      tracker.sendEnd();

      expect(tracker.getViewId().slice(-1)).to.be.equal("1");
    });
  });

  describe("settings", () => {
    it("should set options", () => {
      tracker = new VideoTracker(1, { isAd: true, tag: 2 });
      expect(tracker.isAd()).to.be.true;
      expect(tracker.player).to.equal(1);
      expect(tracker.tag).to.equal(2);

      global.document = { getElementById: function () {} };
      let spy = sinon.spy(document, "getElementById");
      tracker.setPlayer("player", "tag");
      assert(spy.calledTwice);
    });

    it("should send custom data", (done) => {
      tracker = new VideoTracker(null, { customData: { a: 1 } });
      tracker.on(VideoTracker.Events.PLAYER_READY, (e) => {
        expect(e.data.a).to.equal(1);
        done();
      });
      tracker.sendPlayerReady();
    });

    it("should set adsTracker", (done) => {
      tracker = new VideoTracker(null, { adsTracker: new VideoTracker() });
      tracker.adsTracker.on(VideoTracker.Events.AD_END, () => {
        tracker.disposeAdsTracker();
        done();
      });
      tracker.adsTracker.sendRequest();
      tracker.adsTracker.sendEnd();
    });

    it("should calculate webkitbitrate", () => {
      let tag = { webkitVideoDecodedByteCount: 1000 };
      tracker = new VideoTracker(tag);
      expect(tracker.getWebkitBitrate()).to.be.null;

      tag.webkitVideoDecodedByteCount += 3000;
      expect(tracker.getWebkitBitrate()).to.equal(800);
    });

    it("should drop bitrate attributes before content start", () => {
      // Setup jsdom environment
      const dom = new JSDOM("<!doctype html><html><body></body></html>");
      global.window = dom.window;
      global.document = dom.window.document;

      tracker = new VideoTracker();

      // Mock getBitrate to return a value
      tracker.getBitrate = () => 5000000;
      tracker.getRenditionBitrate = () => 4000000;

      // Before content starts (only request sent)
      tracker.sendRequest();
      let attrsBeforeStart = tracker.getAttributes();
      expect(attrsBeforeStart.contentBitrate).to.be.undefined;
      expect(attrsBeforeStart.contentRenditionBitrate).to.be.undefined;

      // After content starts
      tracker.sendStart();
      let attrsAfterStart = tracker.getAttributes();
      expect(attrsAfterStart.contentBitrate).to.equal(5000000);
      expect(attrsAfterStart.contentRenditionBitrate).to.equal(4000000);

      // Other rendition attributes should still be included (even if null) before start
      expect(attrsBeforeStart).to.have.property("contentRenditionName");
      expect(attrsBeforeStart).to.have.property("contentRenditionHeight");
      expect(attrsBeforeStart).to.have.property("contentRenditionWidth");

      // Cleanup
      delete global.window;
      delete global.document;
    });

    it("should drop bitrate attributes before ad start", () => {
      // Setup jsdom environment
      const dom = new JSDOM("<!doctype html><html><body></body></html>");
      global.window = dom.window;
      global.document = dom.window.document;

      tracker = new VideoTracker();
      tracker.setIsAd(true);

      // Mock getBitrate to return a value
      tracker.getBitrate = () => 3000000;
      tracker.getRenditionBitrate = () => 2500000;

      // Before ad starts (only request sent)
      tracker.sendRequest();
      let attrsBeforeStart = tracker.getAttributes();
      expect(attrsBeforeStart.adBitrate).to.be.undefined;
      expect(attrsBeforeStart.adRenditionBitrate).to.be.undefined;

      // After ad starts
      tracker.sendStart();
      let attrsAfterStart = tracker.getAttributes();
      expect(attrsAfterStart.adBitrate).to.equal(3000000);
      expect(attrsAfterStart.adRenditionBitrate).to.equal(2500000);

      // Other rendition attributes should still be included (even if null) before start
      expect(attrsBeforeStart).to.have.property("adRenditionName");
      expect(attrsBeforeStart).to.have.property("adRenditionHeight");
      expect(attrsBeforeStart).to.have.property("adRenditionWidth");

      // Cleanup
      delete global.window;
      delete global.document;
    });
  });

  function generateTests(ads) {
    let type = ads ? "for ads" : "for content";

    describe("EventFiring " + type, () => {
      beforeEach(() => {
        tracker = new VideoTracker();
        tracker.setIsAd(ads);
      });

      it("should return correct shift", () => {
        tracker = new VideoTracker();
        expect(tracker.getRenditionShift(true)).to.be.null;
        tracker.getRenditionBitrate = () => {
          return 1;
        };
        expect(tracker.getRenditionShift(true)).to.be.null;
        tracker.getRenditionBitrate = () => {
          return 2;
        };
        expect(tracker.getRenditionShift()).to.equal("up");
        expect(tracker.getRenditionShift(true)).to.equal("up");
        tracker.getRenditionBitrate = () => {
          return 1;
        };
        expect(tracker.getRenditionShift(true)).to.equal("down");
        expect(tracker.getRenditionShift(true)).to.be.null;
      });

      it("player ready", (done) => {
        tracker.on(VideoTracker.Events.PLAYER_READY, () => done());
        tracker.sendPlayerReady();
      });

      it("download", (done) => {
        tracker.on(VideoTracker.Events.DOWNLOAD, () => done());
        tracker.sendDownload();
      });

      // // Video
      it("request", (done) => {
        let prefix = ads ? "AD_" : "CONTENT_";
        tracker.on(prefix + "REQUEST", () => done());
        tracker.sendRequest();
      });

      it("start", (done) => {
        let prefix = ads ? "AD_" : "CONTENT_";
        tracker.on(prefix + "START", () => done());
        tracker.sendRequest();
        tracker.sendStart();
      });

      it("end", (done) => {
        let prefix = ads ? "AD_" : "CONTENT_";
        tracker.on(prefix + "END", () => done());
        tracker.sendRequest();
        tracker.sendStart();
        tracker.sendEnd();
      });

      it("pause", (done) => {
        let prefix = ads ? "AD_" : "CONTENT_";
        tracker.on(prefix + "PAUSE", () => done());
        tracker.sendRequest();
        tracker.sendStart();
        tracker.sendPause();
      });

      it("resume", (done) => {
        let prefix = ads ? "AD_" : "CONTENT_";
        tracker.on(prefix + "RESUME", () => done());
        tracker.sendRequest();
        tracker.sendStart();
        tracker.sendPause();
        tracker.sendResume();
      });

      it("seek start", (done) => {
        let prefix = ads ? "AD_" : "CONTENT_";
        tracker.on(prefix + "SEEK_START", () => done());
        tracker.sendRequest();
        tracker.sendStart();
        tracker.sendSeekStart();
      });

      it("seek end", (done) => {
        let prefix = ads ? "AD_" : "CONTENT_";
        tracker.on(prefix + "SEEK_END", () => done());
        tracker.sendRequest();
        tracker.sendStart();
        tracker.sendSeekStart();
        tracker.sendSeekEnd();
      });

      it("buffer start", (done) => {
        let prefix = ads ? "AD_" : "CONTENT_";
        tracker.on(prefix + "BUFFER_START", () => done());
        tracker.sendRequest();
        tracker.sendStart();
        tracker.sendBufferStart();
      });

      it("buffer end", (done) => {
        let prefix = ads ? "AD_" : "CONTENT_";
        tracker.on(prefix + "BUFFER_END", () => done());
        tracker.sendRequest();
        tracker.sendStart();
        tracker.sendBufferStart();
        tracker.sendBufferEnd();
      });

      it("heartbeat", (done) => {
        let prefix = ads ? "AD_" : "CONTENT_";
        tracker.on(prefix + "HEARTBEAT", () => done());
        tracker.sendRequest();
        tracker.sendHeartbeat();
      });

      it("rendition change", (done) => {
        let prefix = ads ? "AD_" : "CONTENT_";
        tracker.on(prefix + "RENDITION_CHANGE", () => done());
        tracker.sendRenditionChanged();
      });

      it("error", (done) => {
        let prefix = ads ? "AD_" : "CONTENT_";
        tracker.on(prefix + "ERROR", () => done());
        tracker.sendError();
      });

      // Ads only
      if (ads) {
        it("ad break start", (done) => {
          tracker.on(VideoTracker.Events.AD_BREAK_START, () => done());
          tracker.sendAdBreakStart();
        });

        it("ad break end", (done) => {
          tracker.on(VideoTracker.Events.AD_BREAK_END, () => done());
          tracker.sendAdBreakStart();
          tracker.sendAdBreakEnd();
        });

        it("ad quartile", (done) => {
          tracker.on(VideoTracker.Events.AD_QUARTILE, () => done());
          tracker.sendAdQuartile();
        });

        it("ad click", (done) => {
          tracker.on(VideoTracker.Events.AD_CLICK, () => done());
          tracker.sendAdClick();
        });
      }
    });
  }

  generateTests(false);
  generateTests(true);
});
