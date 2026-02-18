import VideoTracker from "../src/videotracker";
import Log from "../src/log";
import sinon from "sinon";
import { JSDOM } from "jsdom";


describe("VideoTracker", () => {
  let tracker;

  // Mute console
  beforeAll(() => {
    Log.level = Log.Levels.SILENT;
  });

  afterAll(() => {
    Log.level = Log.Levels.ERROR;
  });

  describe("viewId", () => {
    let tracker;

    beforeAll(() => {
      const dom = new JSDOM("<!doctype html><html><body></body></html>");
      global.window = dom.window;
      global.document = dom.window.document;
    });

    afterAll(() => {
      delete global.window;
      delete global.document;
    });

    it("should be incremented after sendEnd", () => {
      tracker = new VideoTracker(1);

      tracker.sendCustom("test");

      expect(tracker.getViewId().slice(-1)).toBe("0");

      tracker.sendRequest();
      expect(tracker.getViewId().slice(-1)).toBe("0");

      tracker.sendStart();
      tracker.sendEnd();

      expect(tracker.getViewId().slice(-1)).toBe("1");
    });
  });

  describe("settings", () => {
    it("should set options", () => {
      tracker = new VideoTracker(1, { isAd: true, tag: 2 });
      expect(tracker.isAd()).toBe(true);
      expect(tracker.player).toBe(1);
      expect(tracker.tag).toBe(2);

      global.document = { getElementById: function () {} };
      let spy = sinon.spy(document, "getElementById");
      tracker.setPlayer("player", "tag");
      expect(spy.calledTwice).toBe(true);
    });

    it("should send custom data", (done) => {
      tracker = new VideoTracker(null, { customData: { a: 1 } });
      tracker.on(VideoTracker.Events.PLAYER_READY, (e) => {
        expect(e.data.a).toBe(1);
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
      expect(tracker.getWebkitBitrate()).toBeNull();

      tag.webkitVideoDecodedByteCount += 3000;
      expect(tracker.getWebkitBitrate()).toBe(800);
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

  describe("Event Firing", () => {
    beforeEach(() => {
      tracker = new VideoTracker();
    });

    it("should return correct shift", () => {
      expect(tracker.getRenditionShift(true)).toBeNull();
      tracker.getRenditionBitrate = () => 1;
      expect(tracker.getRenditionShift(true)).toBeNull();
      tracker.getRenditionBitrate = () => 2;
      expect(tracker.getRenditionShift()).toBe("up");
      expect(tracker.getRenditionShift(true)).toBe("up");
      tracker.getRenditionBitrate = () => 1;
      expect(tracker.getRenditionShift(true)).toBe("down");
      expect(tracker.getRenditionShift(true)).toBeNull();
    });

    it("should fire player ready and download events", (done) => {
      let firedEvents = [];
      tracker.on(VideoTracker.Events.PLAYER_READY, () => {
        firedEvents.push('PLAYER_READY');
      });
      tracker.on(VideoTracker.Events.DOWNLOAD, () => {
        firedEvents.push('DOWNLOAD');
        if (firedEvents.length === 2) done();
      });
      tracker.sendPlayerReady();
      tracker.sendDownload();
    });

    it("should fire content events", (done) => {
      let eventsFired = 0;
      const events = ['CONTENT_REQUEST', 'CONTENT_START', 'CONTENT_END', 'CONTENT_PAUSE',
                      'CONTENT_RESUME', 'CONTENT_SEEK_START', 'CONTENT_SEEK_END',
                      'CONTENT_BUFFER_START', 'CONTENT_BUFFER_END', 'CONTENT_HEARTBEAT',
                      'CONTENT_RENDITION_CHANGE', 'CONTENT_ERROR'];

      events.forEach(event => {
        tracker.on(event, () => {
          eventsFired++;
          if (eventsFired === events.length) done();
        });
      });

      tracker.sendRequest();
      tracker.sendStart();
      tracker.sendEnd();
      tracker.sendRequest();
      tracker.sendStart();
      tracker.sendPause();
      tracker.sendResume();
      tracker.sendSeekStart();
      tracker.sendSeekEnd();
      tracker.sendBufferStart();
      tracker.sendBufferEnd();
      tracker.sendHeartbeat();
      tracker.sendRenditionChanged();
      tracker.sendError();
    });

    it("should fire ad events", (done) => {
      tracker.setIsAd(true);
      let eventsFired = 0;
      const events = ['AD_REQUEST', 'AD_START', 'AD_END', 'AD_PAUSE', 'AD_RESUME',
                      'AD_SEEK_START', 'AD_SEEK_END', 'AD_BUFFER_START', 'AD_BUFFER_END',
                      'AD_HEARTBEAT', 'AD_RENDITION_CHANGE', 'AD_ERROR',
                      'AD_BREAK_START', 'AD_BREAK_END', 'AD_QUARTILE', 'AD_CLICK'];

      events.forEach(event => {
        tracker.on(event, () => {
          eventsFired++;
          if (eventsFired === events.length) done();
        });
      });

      tracker.sendRequest();
      tracker.sendStart();
      tracker.sendEnd();
      tracker.sendRequest();
      tracker.sendStart();
      tracker.sendPause();
      tracker.sendResume();
      tracker.sendSeekStart();
      tracker.sendSeekEnd();
      tracker.sendBufferStart();
      tracker.sendBufferEnd();
      tracker.sendHeartbeat();
      tracker.sendRenditionChanged();
      tracker.sendError();
      tracker.sendAdBreakStart();
      tracker.sendAdBreakEnd();
      tracker.sendAdQuartile();
      tracker.sendAdClick();
    });
  });

  describe("Additional coverage tests", () => {
    beforeEach(() => {
      tracker = new VideoTracker();
    });

    it("should handle state guard conditions for send methods", () => {
      // Test multiple state guards in one test
      tracker.state.goPlayerReady = () => false;
      tracker.state.goRequest = () => false;
      tracker.state.goStart = () => false;
      tracker.state.goEnd = () => false;
      tracker.state.goPause = () => false;
      tracker.state.goResume = () => false;
      tracker.state.goBufferStart = () => false;
      tracker.state.goBufferEnd = () => false;
      tracker.state.goSeekStart = () => false;
      tracker.state.goSeekEnd = () => false;

      const spy = jest.spyOn(tracker, 'sendVideoAction');
      const adSpy = jest.spyOn(tracker, 'sendVideoAdAction');

      tracker.sendPlayerReady();
      tracker.sendRequest();
      tracker.sendStart();
      tracker.sendEnd();
      tracker.sendPause();
      tracker.sendResume();
      tracker.sendBufferStart();
      tracker.sendBufferEnd();
      tracker.sendSeekStart();
      tracker.sendSeekEnd();

      expect(spy).not.toHaveBeenCalled();
      expect(adSpy).not.toHaveBeenCalled();
    });

    it("should handle ads-specific conditions", () => {
      // Test all ad-specific branches
      tracker.setIsAd(false);
      const spy = jest.spyOn(tracker, 'sendVideoAdAction');

      tracker.sendAdBreakStart();
      tracker.sendAdBreakEnd();
      tracker.sendAdQuartile({ quartile: 1 });
      tracker.sendAdClick({ url: 'http://ad.com' });

      expect(spy).not.toHaveBeenCalled();

      // Test state guards for ads
      tracker.setIsAd(true);
      tracker.state.goAdBreakStart = () => false;
      tracker.state.goAdBreakEnd = () => false;

      tracker.sendAdBreakStart();
      tracker.sendAdBreakEnd();

      expect(spy).not.toHaveBeenCalled();
    });

    it("should handle warning conditions", () => {
      const warnSpy = jest.spyOn(Log, 'warn');

      tracker.sendDownload();
      expect(warnSpy).toHaveBeenCalledWith("Called sendDownload without { state: xxxxx }.");

      tracker.setIsAd(true);
      tracker.sendAdQuartile();
      expect(warnSpy).toHaveBeenCalledWith("Called sendAdQuartile without { quartile: xxxxx }.");

      tracker.sendAdClick();
      expect(warnSpy).toHaveBeenCalledWith("Called sendAdClick without { url: xxxxx }.");

      warnSpy.mockRestore();
    });

    it("should handle totalAdTime with nullish coalescing", () => {
      const adsTracker = new VideoTracker();
      adsTracker.setIsAd(true);
      tracker.adsTracker = adsTracker;

      adsTracker.state.totalAdTime = () => null;

      tracker.sendRequest();
      tracker.sendStart();

      expect(tracker.state.isPlaying).toBe(true);
    });

    it("should clear ads time and reset viewId state for content on end", () => {
      const adsTracker = new VideoTracker();
      adsTracker.setIsAd(true);
      tracker.adsTracker = adsTracker;

      const clearSpy = jest.spyOn(adsTracker.state, 'clearTotalAdsTime');
      const resetSpy = jest.spyOn(tracker.state, 'resetViewIdTrackedState');

      tracker.sendRequest();
      tracker.sendStart();
      tracker.sendEnd();

      expect(clearSpy).toHaveBeenCalled();
      expect(resetSpy).toHaveBeenCalled();
    });

    it("should set bufferType from _lastBufferType when not null", () => {
      tracker.sendRequest();
      tracker.sendStart();

      tracker.sendBufferStart();
      tracker.sendBufferEnd();

      tracker.sendBufferStart({ bufferType: 'connection' });

      let bufferEndData;
      tracker.on(VideoTracker.Events.CONTENT_BUFFER_END, (e) => {
        bufferEndData = e.data;
      });

      tracker.sendBufferEnd();
      expect(bufferEndData.bufferType).toBe('connection');
    });

    it("should not send heartbeat when not requested", () => {
      tracker.state.isRequested = false;
      const spy = jest.spyOn(tracker, 'sendVideoAction');

      tracker.sendHeartbeat();
      expect(spy).not.toHaveBeenCalled();
    });

    it("should adjust elapsed time to 0 for edge cases", () => {
      tracker.sendRequest();
      tracker.sendStart();

      // Test paused elapsed time < 10
      tracker.sendPause();
      tracker.getHeartbeat = () => 8;
      const originalGetDeltaTime = tracker.state.elapsedTime.getDeltaTime.bind(tracker.state.elapsedTime);
      tracker.state.elapsedTime.getDeltaTime = () => 3;
      tracker.sendHeartbeat();
      tracker.state.elapsedTime.getDeltaTime = originalGetDeltaTime;
      expect(tracker.state.isPaused).toBe(true);

      // Test buffering elapsed time < 5
      tracker.sendResume();
      tracker.sendBufferStart();
      tracker.getHeartbeat = () => 7;
      const originalBufferGetDeltaTime = tracker.state.bufferElapsedTime.getDeltaTime.bind(tracker.state.bufferElapsedTime);
      tracker.state.bufferElapsedTime.getDeltaTime = () => 3;
      tracker.sendHeartbeat();
      tracker.state.bufferElapsedTime.getDeltaTime = originalBufferGetDeltaTime;
      expect(tracker.state.isBuffering).toBe(true);
    });

    it("should set user ID", () => {
      tracker.setUserId("user123");
      expect(tracker._userId).toBe("user123");
    });

    it("should return null for getAdQuartile", () => {
      expect(tracker.getAdQuartile()).toBeNull();
    });

    it("should handle ads tracker states and interactions", (done) => {
      const adsTracker = new VideoTracker();
      adsTracker.setIsAd(true);
      tracker.adsTracker = adsTracker;

      // Test totalAdPlaytime
      adsTracker.state.totalAdPlaytime = 5000;
      tracker.on(VideoTracker.Events.CONTENT_REQUEST, (e) => {
        expect(e.data.totalAdPlaytime).toBe(5000);
      });
      tracker.sendRequest();

      // Test ad in playing state reset
      adsTracker.state.isPlaying = true;
      adsTracker.state.startAdsTime();
      tracker.sendStart();
      expect(adsTracker.state.isPlaying).toBe(false);

      // Test ad in buffering state reset
      tracker = new VideoTracker();
      const adsTracker2 = new VideoTracker();
      adsTracker2.setIsAd(true);
      tracker.adsTracker = adsTracker2;
      adsTracker2.state.isBuffering = true;
      adsTracker2.state.startAdsTime();
      tracker.sendRequest();
      tracker.sendStart();
      expect(adsTracker2.state.isBuffering).toBe(false);

      done();
    });

    it("should handle buffer and heartbeat edge cases", (done) => {
      tracker.sendRequest();
      tracker.sendStart();

      // Test isInitialBuffering
      tracker.on(VideoTracker.Events.CONTENT_BUFFER_START, (e) => {
        expect(e.data.isInitialBuffering).toBe(false);
      });
      tracker.sendBufferStart({ timeSinceStarted: 150 });

      // Test _acc accumulator
      tracker.state._acc = 100;
      tracker.sendHeartbeat();
      expect(tracker.state._acc).toBe(0);

      // Test paused state
      tracker.sendPause();
      tracker.state.elapsedTime.start();
      tracker.sendHeartbeat();
      expect(tracker.state.isPaused).toBe(true);

      // Test _bufferAcc accumulator
      tracker.sendResume();
      tracker.state._bufferAcc = 50;
      tracker.sendHeartbeat();
      expect(tracker.state._bufferAcc).toBe(0);

      // Test buffering state
      tracker.sendBufferStart();
      tracker.sendHeartbeat();
      expect(tracker.state.isBuffering).toBe(true);

      // Test bitmovin-ads player
      tracker.setIsAd(true);
      tracker.getPlayerName = () => "bitmovin-ads";
      const spy = jest.spyOn(tracker, 'sendVideoAdAction');
      tracker.sendHeartbeat();
      expect(spy).toHaveBeenCalled();

      done();
    });

    it("should handle parent-child tracker interactions", (done) => {
      const parentTracker = new VideoTracker();
      const adTracker = new VideoTracker();

      parentTracker.setAdsTracker(adTracker);

      const spy = jest.spyOn(parentTracker.state, 'goLastAd');
      let errorHandled = false;

      parentTracker.on(VideoTracker.Events.AD_ERROR, () => {
        errorHandled = true;
      });

      adTracker.sendError();
      expect(errorHandled).toBe(true);

      adTracker.sendRequest();
      adTracker.sendStart();
      adTracker.sendEnd();
      expect(spy).toHaveBeenCalled();

      spy.mockClear();
      adTracker.sendAdBreakStart();
      adTracker.sendAdBreakEnd();
      expect(spy).toHaveBeenCalled();

      done();
    });
  });
});
