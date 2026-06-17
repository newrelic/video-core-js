import sinon from "sinon";
import fs from "fs";
import path from "path";
import ConnectedDeviceHarvester from "../src/connectedDevice/connectedDeviceHarvester";
import {
  MOBILE_ENDPOINT_US,
  MOBILE_ENDPOINT_EU,
  STAGING_MOBILE_ENDPOINT,
  CD_DEVICE_INFO,
  CD_METADATA,
} from "../src/constants";
import Tracker from "../src/tracker";
import Log from "../src/log";

/**
 * ConnectedDeviceHarvester unit tests. Covers T-CDH-1..18, T-CDH-26 from vega-spec.md.
 *
 * Each test stubs `global.fetch` before constructing the harvester so the
 * fire-and-forget `initialise()` call in the constructor doesn't make real
 * network requests.
 */
describe("ConnectedDeviceHarvester", () => {
  let stubs = [];
  let fetchStub;

  /** Build a harvester with sane defaults. */
  function makeHarvester(overrides = {}) {
    return new ConnectedDeviceHarvester({
      accountId: "acct-1",
      applicationToken: "tok-1",
      endpoint: "US",
      ...overrides,
    });
  }

  /** Returns a fetch stub that resolves with a connect response carrying a dataToken. */
  function makeConnectFetch(dataToken = ["t1", "t2"]) {
    return sinon.stub().resolves({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data_token: dataToken }),
    });
  }

  beforeAll(() => {
    Log.level = Log.Levels.SILENT;
  });

  afterAll(() => {
    Log.level = Log.Levels.ERROR;
  });

  beforeEach(() => {
    fetchStub = makeConnectFetch();
    global.fetch = fetchStub;
    delete globalThis.__NRVIDEO_CD__;
    stubs = [];
  });

  afterEach(() => {
    stubs.forEach((s) => s.restore && s.restore());
    stubs = [];
    delete globalThis.__NRVIDEO_CD__;
    delete global.fetch;
  });

  // ====== T-CDH-1, T-CDH-2 — constructor validation ======

  describe("constructor", () => {
    it("T-CDH-1: throws when applicationToken is missing", () => {
      expect(() =>
        new ConnectedDeviceHarvester({ accountId: "x", endpoint: "US" })
      ).toThrow(/applicationToken is required/);
    });

    it("T-CDH-2: throws on invalid endpoint", () => {
      expect(() =>
        new ConnectedDeviceHarvester({ applicationToken: "t", endpoint: "INVALID" })
      ).toThrow(/Invalid endpoint/);
    });

    it("accepts US, EU, and staging endpoints", () => {
      expect(() => makeHarvester({ endpoint: "US" })).not.toThrow();
      expect(() => makeHarvester({ endpoint: "EU" })).not.toThrow();
      expect(() => makeHarvester({ endpoint: "staging" })).not.toThrow();
    });
  });

  // ====== T-CDH-3, T-CDH-4, T-CDH-19 — connect URL + headers ======

  describe("fetchDataTokens", () => {
    it("T-CDH-3: POSTs to prod /v5/connect with correct headers when endpoint=US", async () => {
      const h = makeHarvester({ endpoint: "US" });
      // Wait for the fire-and-forget initialise.
      await Promise.resolve();
      await Promise.resolve();
      expect(fetchStub.called).toBe(true);
      const [url, opts] = fetchStub.firstCall.args;
      expect(url).toBe(`${MOBILE_ENDPOINT_US}/v5/connect`);
      expect(opts.method).toBe("POST");
      expect(opts.headers["Content-Type"]).toBe("application/json");
      expect(opts.headers["X-App-License-Key"]).toBe("tok-1");
      h.dispose();
    });

    it("T-CDH-4 / T-CDH-19: POSTs to staging /v5/connect when endpoint=staging", async () => {
      const h = makeHarvester({ endpoint: "staging" });
      await Promise.resolve();
      await Promise.resolve();
      expect(fetchStub.firstCall.args[0]).toBe(
        `${STAGING_MOBILE_ENDPOINT}/v5/connect`
      );
      h.dispose();
    });

    it("T-CDH-5: stores data_token from response body", async () => {
      fetchStub = makeConnectFetch(["A", "B", "C"]);
      global.fetch = fetchStub;
      const h = makeHarvester();
      // flush microtasks for the async initialise chain
      for (let i = 0; i < 5; i++) await Promise.resolve();
      expect(h.dataToken).toEqual(["A", "B", "C"]);
      h.dispose();
    });
  });

  // ====== T-CDH-6 — exp-backoff retry up to 10 attempts ======

  describe("connect retry behavior", () => {
    it("T-CDH-6: retries with exp-backoff on 500, gives up after 10 and leaves dataToken null", async () => {
      jest.useFakeTimers();
      const failingFetch = sinon
        .stub()
        .resolves({ ok: false, status: 500, json: () => Promise.resolve({}) });
      global.fetch = failingFetch;

      const h = makeHarvester();

      // Drive timers forward to flush all backoff retries (up to 2^9 * 1000ms).
      for (let i = 0; i < 12; i++) {
        await Promise.resolve();
        jest.runAllTimers();
        await Promise.resolve();
      }

      expect(failingFetch.callCount).toBe(10); // T-CDH-11: gives up after 10
      expect(h.dataToken).toBe(null);          // null dataToken gates sendBufferedEvents

      jest.useRealTimers();
      h.dispose();
    });
  });

  // ====== T-CDH-7 — addEvent preserves emit-time timestamp ======

  describe("addEvent", () => {
    it("T-CDH-7: appends non-QoE event preserving the recordEvent-stage timestamp", async () => {
      const h = makeHarvester();
      const emitTimestamp = 1700000000000;
      h.addEvent({ actionName: "CONTENT_START", foo: "bar", timestamp: emitTimestamp });
      const buffered = h.eventBuffer.drain();
      expect(buffered).toHaveLength(1);
      expect(buffered[0].actionName).toBe("CONTENT_START");
      expect(buffered[0].foo).toBe("bar");
      expect(buffered[0].timestamp).toBe(emitTimestamp);
      h.dispose();
    });

    it("T-CDH-14: dedupes QOE_AGGREGATE by viewId", async () => {
      const h = makeHarvester();
      h.addEvent({
        actionName: Tracker.Events.QOE_AGGREGATE,
        viewId: "v1",
        kpi: 1,
      });
      h.addEvent({
        actionName: Tracker.Events.QOE_AGGREGATE,
        viewId: "v1",
        kpi: 2,
      });
      h.addEvent({
        actionName: Tracker.Events.QOE_AGGREGATE,
        viewId: "v2",
        kpi: 3,
      });
      const buffered = h.eventBuffer.drain();
      expect(buffered).toHaveLength(2);
      const v1 = buffered.find((e) => e.viewId === "v1");
      const v2 = buffered.find((e) => e.viewId === "v2");
      expect(v1.kpi).toBe(2); // last write wins for v1
      expect(v2.kpi).toBe(3);
      h.dispose();
    });
  });

  // ====== T-CDH-8, T-CDH-9 — sendBufferedEvents guards ======

  describe("sendBufferedEvents guards", () => {
    it("T-CDH-8: no-ops when dataToken is null", async () => {
      const h = makeHarvester();
      h.dataToken = null;
      h.addEvent({ actionName: "CONTENT_START" });
      const beforeCalls = fetchStub.callCount;
      await h.sendBufferedEvents();
      expect(fetchStub.callCount).toBe(beforeCalls); // no /v3/data call
      h.dispose();
    });

    it("T-CDH-9: no-ops when buffer is empty", async () => {
      const h = makeHarvester();
      h.dataToken = ["t1"];
      const beforeCalls = fetchStub.callCount;
      await h.sendBufferedEvents();
      expect(fetchStub.callCount).toBe(beforeCalls);
      h.dispose();
    });
  });

  // ====== T-CDH-10 — 10-tuple body ======

  describe("/v3/data wire format", () => {
    it("T-CDH-10: POSTs 10-tuple body in correct positional order", async () => {
      const h = makeHarvester();
      h.dataToken = ["TKN"];
      h.addEvent({ actionName: "CONTENT_START" });

      // Swap fetch with a fresh stub that captures the data POST.
      const dataFetch = sinon
        .stub()
        .resolves({ ok: true, status: 200, json: () => Promise.resolve({}) });
      global.fetch = dataFetch;

      await h.sendBufferedEvents();

      expect(dataFetch.calledOnce).toBe(true);
      const [url, opts] = dataFetch.firstCall.args;
      expect(url).toBe(`${MOBILE_ENDPOINT_US}/v3/data`);
      const body = JSON.parse(opts.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(10);
      expect(body[0]).toEqual(["TKN"]); // dataToken
      expect(body[1]).toEqual(CD_DEVICE_INFO); // device info
      expect(body[2]).toBe(0);
      expect(body[3]).toEqual([]);
      expect(body[8]).toEqual(CD_METADATA); // session metadata
      expect(Array.isArray(body[9])).toBe(true); // events
      expect(body[9]).toHaveLength(1);
      expect(body[9][0].actionName).toBe("CONTENT_START");
      h.dispose();
    });
  });

  // ====== T-CDH-11 — re-queue on failure ======

  describe("send failure handling", () => {
    it("T-CDH-11: re-queues drained events on /v3/data failure", async () => {
      const h = makeHarvester();
      h.dataToken = ["TKN"];
      h.addEvent({ actionName: "CONTENT_START" });
      h.addEvent({ actionName: "CONTENT_END" });

      const dataFetch = sinon.stub().rejects(new Error("network down"));
      global.fetch = dataFetch;

      await h.sendBufferedEvents();

      // Buffer should be repopulated with both events.
      const buffered = h.eventBuffer.drain();
      expect(buffered).toHaveLength(2);
      expect(buffered.map((e) => e.actionName).sort()).toEqual([
        "CONTENT_END",
        "CONTENT_START",
      ]);
      h.dispose();
    });
  });

  // ====== T-CDH-12 — dispose ======

  describe("dispose", () => {
    it("T-CDH-12: marks disposed, performs best-effort final send, and prevents future harvest starts", async () => {
      const h = makeHarvester();
      // Let constructor's fire-and-forget initialise() settle.
      for (let i = 0; i < 5; i++) await Promise.resolve();

      const sendSpy = sinon.spy(h, "sendBufferedEvents");
      await h.dispose();

      // Final send attempted.
      expect(sendSpy.calledOnce).toBe(true);

      // isDisposed blocks any future startHarvestInterval calls.
      expect(h.isDisposed).toBe(true);

      // Calling startHarvestInterval after dispose is a no-op.
      const wasRunning = h.timer.isRunning();
      h.startHarvestInterval();
      expect(h.timer.isRunning()).toBe(wasRunning); // unchanged — blocked by isDisposed guard

      sendSpy.restore();
    });
  });

  // ====== T-CDH-13 — grep test (no banned DOM APIs) ======

  describe("REQ-CDH-20 (no DOM APIs)", () => {
    it("T-CDH-13: source contains no document, window.location, sendBeacon, localStorage, or addEventListener (outside JSDoc comments)", () => {
      const src = fs.readFileSync(
        path.resolve(__dirname, "../src/connectedDevice/connectedDeviceHarvester.js"),
        "utf8"
      );
      // Strip JSDoc comment blocks before grepping.
      const stripped = src.replace(/\/\*\*[\s\S]*?\*\//g, "");
      const banned = [
        /\bdocument\b/,
        /\bwindow\.location\b/,
        /\bnavigator\.sendBeacon\b/,
        /\bnavigator\.platform\b/,
        /\blocalStorage\b/,
        /\baddEventListener\b/,
      ];
      banned.forEach((re) => {
        expect(stripped).not.toMatch(re);
      });
    });
  });

  // ====== T-CDH-15, T-CDH-16, T-CDH-17 — QoE cycle filter, dirty check, force flag ======

  describe("QoE cycle filter and dirty check", () => {
    function setupQoeGlobal(qoeIntervalFactor) {
      globalThis.__NRVIDEO_CD__ = {
        info: { applicationToken: "tok-1", endpoint: "US" },
        config: { qoeAggregate: true, qoeIntervalFactor },
      };
    }

    it("T-CDH-15: ships QOE_AGGREGATE only on cycles 1, N+1, 2N+1 when qoeIntervalFactor=N", async () => {
      setupQoeGlobal(3);
      const h = makeHarvester();
      h.dataToken = ["TKN"];
      // Pre-seed lastSentQoeKpis so dirty-check doesn't drop the QoE on cycle 1
      // (we want to isolate the cycle filter alone here).
      h._lastSentQoeKpis = {};

      const dataFetch = sinon
        .stub()
        .resolves({ ok: true, status: 200, json: () => Promise.resolve({}) });
      global.fetch = dataFetch;

      // Helper: re-add a fresh QoE event each cycle (drained ones get filtered).
      // Use a real QOE_KPI_KEYS field (peakBitrate) so the dirty check sees
      // changes between cycles. Without that, cycle 4's "unchanged" KPIs
      // would get filtered out by the dirty check before the send.
      let bitrate = 1000;
      const cycle = async () => {
        h.addEvent({
          actionName: Tracker.Events.QOE_AGGREGATE,
          viewId: "v1",
          peakBitrate: bitrate++,
        });
        await h.sendBufferedEvents();
      };

      await cycle(); // qoeCycleCount enters at 1, isQoeCycle = (0 % 3 === 0) = true
      await cycle(); // 1 % 3 === 1 → false
      await cycle(); // 2 % 3 === 2 → false
      await cycle(); // 3 % 3 === 0 → true

      // Cycles 1 and 4 should ship; cycles 2 and 3 re-buffer.
      expect(dataFetch.callCount).toBe(2);
      h.dispose();
    });

    it("T-CDH-16: skips QoE when KPIs unchanged across cycles", async () => {
      setupQoeGlobal(1);
      const h = makeHarvester();
      h.dataToken = ["TKN"];

      const dataFetch = sinon
        .stub()
        .resolves({ ok: true, status: 200, json: () => Promise.resolve({}) });
      global.fetch = dataFetch;

      // First cycle: kpi=1 — should ship.
      h.addEvent({
        actionName: Tracker.Events.QOE_AGGREGATE,
        viewId: "v1",
        kpi: 1,
      });
      await h.sendBufferedEvents();
      const sentOnce = dataFetch.callCount;

      // Second cycle: same kpi — should NOT ship (dirty check skips).
      h.addEvent({
        actionName: Tracker.Events.QOE_AGGREGATE,
        viewId: "v1",
        kpi: 1,
      });
      await h.sendBufferedEvents();

      expect(dataFetch.callCount).toBe(sentOnce); // no new send
      h.dispose();
    });

    it("T-CDH-17: forceQoeNextHarvest forces ship regardless of multiplier or dirty check", async () => {
      setupQoeGlobal(10); // would normally skip
      const h = makeHarvester();
      h.dataToken = ["TKN"];

      const dataFetch = sinon
        .stub()
        .resolves({ ok: true, status: 200, json: () => Promise.resolve({}) });
      global.fetch = dataFetch;

      h.qoeCycleCount = 5; // not on a multiple of 10
      h.forceQoeNextHarvest();
      h.addEvent({
        actionName: Tracker.Events.QOE_AGGREGATE,
        viewId: "v1",
        kpi: 1,
      });
      await h.sendBufferedEvents();

      expect(dataFetch.callCount).toBe(1);
      expect(h.forceQoeNextCycle).toBe(false); // reset after use
      h.dispose();
    });
  });

  // ====== T-CDH-18 — before-drain callback ======

  describe("setBeforeDrainCallback", () => {
    it("T-CDH-18: callback runs before drain on every send cycle", async () => {
      const h = makeHarvester();
      h.dataToken = ["TKN"];
      const cb = sinon.spy();
      h.setBeforeDrainCallback(cb);
      h.addEvent({ actionName: "CONTENT_START" });

      const dataFetch = sinon
        .stub()
        .resolves({ ok: true, status: 200, json: () => Promise.resolve({}) });
      global.fetch = dataFetch;

      await h.sendBufferedEvents();
      expect(cb.calledOnce).toBe(true);

      h.addEvent({ actionName: "CONTENT_END" });
      await h.sendBufferedEvents();
      expect(cb.calledTwice).toBe(true);
      h.dispose();
    });
  });

  // ====== T-CDH-26 — lazy construction marker ======

  describe("REQ-CDH-26 lazy construction (drives integration with ConnectedDeviceAnalyticsAgent)", () => {
    it("T-CDH-26: ConnectedDeviceHarvester constructor IS callable without globalThis.__NRVIDEO_CD__ — confirming the class is decoupled from the Vega global", () => {
      // The Vega-specific lazy-init lives in ConnectedDeviceAnalyticsAgent (T-VA-3), not the
      // harvester. Construction here works as long as info is passed
      // directly. This guards against future refactors that might
      // accidentally inline a __NRVIDEO_CD__ read into the constructor.
      delete globalThis.__NRVIDEO_CD__;
      const h = new ConnectedDeviceHarvester({
        applicationToken: "tok",
        endpoint: "US",
      });
      expect(h).toBeInstanceOf(ConnectedDeviceHarvester);
      h.dispose();
    });
  });
});
