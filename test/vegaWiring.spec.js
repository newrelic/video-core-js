import sinon from "sinon";
import { JSDOM } from "jsdom";
import Core from "../src/core";
import { recordEvent } from "../src/recordEvent";
import { setVideoConfig, videoConfiguration } from "../src/videoConfiguration";
import { videoAnalyticsHarvester } from "../src/agent";
import VideoTracker from "../src/videotracker";
import Log from "../src/log";

/**
 * Vega wiring tests. Covers T-CO-1, T-CO-2, T-CO-3..7, T-CO-9..15
 * from vega-spec.md.
 *
 * Kept in a dedicated file (rather than appended to existing spec files)
 * to minimize regression risk against the established test suites.
 */
describe("Vega core wiring", () => {
  let stubs = [];
  let fetchStub;

  beforeAll(() => {
    Log.level = Log.Levels.SILENT;
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    global.window = dom.window;
    global.document = dom.window.document;
  });

  afterAll(() => {
    Log.level = Log.Levels.ERROR;
    delete global.window;
    delete global.document;
  });

  beforeEach(() => {
    fetchStub = sinon.stub().resolves({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data_token: ["TKN"] }),
    });
    global.fetch = fetchStub;
    delete globalThis.__NRVIDEO_VEGA__;
    delete global.window.NRVIDEO;
    stubs = [];
  });

  afterEach(() => {
    stubs.forEach((s) => s.restore && s.restore());
    stubs = [];
    delete globalThis.__NRVIDEO_VEGA__;
    delete global.window.NRVIDEO;
    delete global.fetch;
  });

  // ====== T-CO-1, T-CO-2 — Core.addTracker forwards options.src ======

  describe("Core.addTracker", () => {
    it("T-CO-1: always calls setVideoConfig(info, config, src) when info is present (no license-key gate)", () => {
      const setConfSpy = sinon.spy(videoConfiguration, "setConfiguration");
      stubs.push(setConfSpy);

      const tracker = { on() {}, off() {}, emit() {}, dispose() {} };
      Core.addTracker(tracker, {
        info: { licenseKey: "lk", appName: "app", region: "US" },
        config: { qoeAggregate: false },
      });

      expect(setConfSpy.calledOnce).toBe(true);
      const call = setConfSpy.firstCall;
      expect(call.args[0]).toEqual({
        licenseKey: "lk",
        appName: "app",
        region: "US",
      });
      expect(call.args[1]).toEqual({ qoeAggregate: false });
    });

    it("T-CO-2: forwards options.src as the third arg", () => {
      const setConfSpy = sinon.spy(videoConfiguration, "setConfiguration");
      stubs.push(setConfSpy);

      const tracker = { on() {}, off() {}, emit() {}, dispose() {} };
      Core.addTracker(tracker, {
        info: { applicationToken: "tok", endpoint: "US" },
        config: {},
        src: "Vega",
      });

      expect(setConfSpy.firstCall.args[2]).toBe("Vega");
    });

    it("T-CO-2 (regression guard): src is undefined when caller omits options.src", () => {
      const setConfSpy = sinon.spy(videoConfiguration, "setConfiguration");
      stubs.push(setConfSpy);

      const tracker = { on() {}, off() {}, emit() {}, dispose() {} };
      Core.addTracker(tracker, {
        info: { licenseKey: "lk", appName: "app", region: "US" },
      });

      expect(setConfSpy.firstCall.args[2]).toBeUndefined();
    });
  });

  // ====== T-CO-3..7 — recordEvent routing ======

  describe("recordEvent routing", () => {
    let vegaAddEventSpy;
    let videoAddEventSpy;
    let agent;

    beforeEach(() => {
      // Spy the two harvesters' addEvent methods.
      // Use jest.isolateModules to grab a fresh vegaAgent (its module-level
      // singleton is created at module load).
      jest.isolateModules(() => {
        agent = require("../src/vegaAgent").vegaAnalyticsHarvester;
      });
      // Note: the production recordEvent imports its own vegaAgent reference.
      // We test routing by inspecting which harvester was called via direct
      // references read from the same module graph.
      const live = require("../src/vegaAgent").vegaAnalyticsHarvester;
      vegaAddEventSpy = sinon.spy(live, "addEvent");
      videoAddEventSpy = sinon.spy(videoAnalyticsHarvester, "addEvent");
      stubs.push(vegaAddEventSpy, videoAddEventSpy);
    });

    afterEach(() => {
      const live = require("../src/vegaAgent").vegaAnalyticsHarvester;
      live.addEvent.restore && live.addEvent.restore();
      videoAnalyticsHarvester.addEvent.restore &&
        videoAnalyticsHarvester.addEvent.restore();
    });

    it("T-CO-3: routes to vegaAnalyticsHarvester when attributes.src === 'Vega'", () => {
      globalThis.__NRVIDEO_VEGA__ = {
        info: { applicationToken: "tok", endpoint: "US" },
        config: {},
      };
      // Browser global also present — we verify routing chooses by att.src,
      // not by which global is set.
      global.window.NRVIDEO = {
        info: { appName: "app", licenseKey: "lk" },
        config: {},
      };

      recordEvent("VideoAction", { src: "Vega", actionName: "CONTENT_START" });

      const live = require("../src/vegaAgent").vegaAnalyticsHarvester;
      expect(live.addEvent.called).toBe(true);
      expect(videoAnalyticsHarvester.addEvent.called).toBe(false);
    });

    it("T-CO-4: routes to videoAnalyticsHarvester when att.src is missing or 'Browser' (regression guard)", () => {
      global.window.NRVIDEO = {
        info: { appName: "app", licenseKey: "lk" },
        config: {},
      };

      recordEvent("VideoAction", { actionName: "CONTENT_START" });
      expect(videoAnalyticsHarvester.addEvent.calledOnce).toBe(true);

      recordEvent("VideoAction", { src: "Browser", actionName: "CONTENT_END" });
      expect(videoAnalyticsHarvester.addEvent.calledTwice).toBe(true);

      const live = require("../src/vegaAgent").vegaAnalyticsHarvester;
      expect(live.addEvent.called).toBe(false);
    });

    it("T-CO-5: reads info from globalThis.__NRVIDEO_VEGA__.info on Vega path", () => {
      globalThis.__NRVIDEO_VEGA__ = {
        info: {
          applicationToken: "tok",
          endpoint: "US",
          appName: "vega-app",
        },
        config: {},
      };

      recordEvent("VideoAction", { src: "Vega", actionName: "CONTENT_START" });

      const live = require("../src/vegaAgent").vegaAnalyticsHarvester;
      const sentEvent = live.addEvent.firstCall.args[0];
      expect(sentEvent.appName).toBe("vega-app");
    });

    it("T-CO-6: builds QoE companion when globalThis.__NRVIDEO_VEGA__.config.qoeAggregate is true on Vega path", () => {
      globalThis.__NRVIDEO_VEGA__ = {
        info: { applicationToken: "tok", endpoint: "US" },
        config: { qoeAggregate: true },
      };

      recordEvent("VideoAction", { src: "Vega", actionName: "CONTENT_START" });

      const live = require("../src/vegaAgent").vegaAnalyticsHarvester;
      // Should be called twice: main event + QOE_AGGREGATE companion.
      expect(live.addEvent.calledTwice).toBe(true);
      const second = live.addEvent.secondCall.args[0];
      expect(second.actionName).toBe("QOE_AGGREGATE");
    });

    it("T-CO-7: skips timeSinceLoad enrichment on Vega path; includes it on browser path", () => {
      globalThis.__NRVIDEO_VEGA__ = {
        info: { applicationToken: "tok", endpoint: "US" },
        config: {},
      };
      global.window.NRVIDEO = {
        info: { appName: "app", licenseKey: "lk" },
        config: {},
      };

      recordEvent("VideoAction", { src: "Vega", actionName: "CONTENT_START" });
      const live = require("../src/vegaAgent").vegaAnalyticsHarvester;
      const vegaEvent = live.addEvent.firstCall.args[0];
      expect(vegaEvent.timeSinceLoad).toBeUndefined();

      recordEvent("VideoAction", { actionName: "CONTENT_START" });
      const browserEvent = videoAnalyticsHarvester.addEvent.firstCall.args[0];
      expect(browserEvent).toHaveProperty("timeSinceLoad");
    });
  });

  // ====== T-CO-9..13 — videoConfiguration branching ======

  describe("setConfiguration validation + global write", () => {
    it("T-CO-9: when src === 'Vega', runs validateVegaFields; rejects missing applicationToken", () => {
      const ok = setVideoConfig(
        { applicationToken: "tok", endpoint: "US" },
        {},
        "Vega"
      );
      expect(ok).toBe(true);
      expect(globalThis.__NRVIDEO_VEGA__).toBeDefined();
      expect(globalThis.__NRVIDEO_VEGA__.info.applicationToken).toBe("tok");

      const fail = setVideoConfig({ endpoint: "US" }, {}, "Vega");
      expect(fail).toBe(false);

      const failEndpoint = setVideoConfig(
        { applicationToken: "tok", endpoint: "INVALID" },
        {},
        "Vega"
      );
      expect(failEndpoint).toBe(false);
    });

    it("T-CO-10: when src is undefined or non-'Vega', runs validateRequiredFields (regression guard)", () => {
      // No src → NR validation runs, rejects without licenseKey.
      const fail = setVideoConfig({ appName: "app", region: "US" });
      expect(fail).toBe(false);

      // Non-Vega string also runs NR validation.
      const failNonVega = setVideoConfig(
        { appName: "app", region: "US" },
        {},
        "SomethingElse"
      );
      expect(failNonVega).toBe(false);

      // With licenseKey, NR path succeeds.
      const ok = setVideoConfig(
        { licenseKey: "lk", appName: "app", region: "US" },
        {}
      );
      expect(ok).toBe(true);
      expect(global.window.NRVIDEO).toBeDefined();
    });

    it("T-CO-11: when src === 'Vega', writes globalThis.__NRVIDEO_VEGA__ with info+config only (no harvester field, not window.NRVIDEO)", () => {
      setVideoConfig(
        {
          accountId: "acct",
          applicationToken: "tok",
          endpoint: "US",
          appName: "myApp",
          applicationID: "appId",
        },
        { qoeAggregate: true, qoeIntervalFactor: 5 },
        "Vega"
      );

      const g = globalThis.__NRVIDEO_VEGA__;
      expect(g).toBeDefined();
      expect(g.info).toEqual({
        accountId: "acct",
        applicationToken: "tok",
        endpoint: "US",
        appName: "myApp",
        applicationID: "appId",
      });
      expect(g.config).toEqual({
        qoeAggregate: true,
        qoeIntervalFactor: 5,
      });
      expect("harvester" in g).toBe(false); // No harvester field.
      expect(global.window.NRVIDEO).toBeUndefined(); // No NR write.
    });

    it("T-CO-12: when src is not 'Vega', writes window.NRVIDEO unchanged (regression guard)", () => {
      setVideoConfig(
        { licenseKey: "lk", appName: "app", region: "US" },
        { qoeAggregate: false }
      );
      expect(global.window.NRVIDEO).toBeDefined();
      expect(global.window.NRVIDEO.info.licenseKey).toBe("lk");
      expect(globalThis.__NRVIDEO_VEGA__).toBeUndefined();
    });

    it("T-CO-13: when src === 'Vega' and global is already set, info/config are last-wins; global never carries a harvester field", () => {
      setVideoConfig(
        { applicationToken: "tok-1", endpoint: "US" },
        { qoeAggregate: false },
        "Vega"
      );
      expect(globalThis.__NRVIDEO_VEGA__.info.applicationToken).toBe("tok-1");

      setVideoConfig(
        { applicationToken: "tok-2", endpoint: "EU" },
        { qoeAggregate: true, qoeIntervalFactor: 3 },
        "Vega"
      );
      expect(globalThis.__NRVIDEO_VEGA__.info.applicationToken).toBe("tok-2");
      expect(globalThis.__NRVIDEO_VEGA__.info.endpoint).toBe("EU");
      expect(globalThis.__NRVIDEO_VEGA__.config.qoeIntervalFactor).toBe(3);
      expect("harvester" in globalThis.__NRVIDEO_VEGA__).toBe(false);
    });
  });

  // ====== T-CO-14, T-CO-15 — videotracker._src + att.src ======

  describe("VideoTracker._src + att.src", () => {
    it("T-CO-14: setOptions stores options.src on this._src; this._src defaults to null when omitted", () => {
      const t = new VideoTracker();
      expect(t._src).toBe(null);
      t.setOptions({ src: "Vega" });
      expect(t._src).toBe("Vega");
      t.setOptions({ src: "Browser" });
      expect(t._src).toBe("Browser");
      // Omitted src leaves _src untouched.
      t.setOptions({ heartbeat: 1000 });
      expect(t._src).toBe("Browser");
    });

    it("T-CO-15: getAttributes returns att.src='Browser' when _src is null (regression guard); 'Vega' when _src='Vega'", () => {
      const t = new VideoTracker();
      // VideoTracker.getAttributes returns att with src filled in.
      const browserAtt = t.getAttributes({}, "VideoAction");
      expect(browserAtt.src).toBe("Browser");

      t._src = "Vega";
      const vegaAtt = t.getAttributes({}, "VideoAction");
      expect(vegaAtt.src).toBe("Vega");
    });
  });
});
