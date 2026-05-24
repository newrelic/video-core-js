import sinon from "sinon";
import Log from "../src/log";

/**
 * VegaAnalyticsAgent unit tests. Covers T-VA-1..4 from vega-spec.md.
 *
 * Each test re-imports `vegaAgent` via `jest.isolateModules` so the
 * module-level singleton constructor runs in a fresh state. This is
 * required because the singleton is created at module-load time
 * (REQ-CO-7 part d) and persists across tests otherwise.
 */
describe("VegaAnalyticsAgent / vegaAnalyticsHarvester", () => {
  let stubs = [];
  let fetchStub;

  /** Returns a fetch stub that resolves with a connect response. */
  function makeConnectFetch() {
    return sinon.stub().resolves({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data_token: ["TKN"] }),
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
    delete globalThis.__NRVIDEO_VEGA__;
    stubs = [];
  });

  afterEach(() => {
    stubs.forEach((s) => s.restore && s.restore());
    stubs = [];
    delete globalThis.__NRVIDEO_VEGA__;
    delete global.fetch;
  });

  // ====== T-VA-1 — module singleton identity ======

  it("T-VA-1: vegaAnalyticsHarvester is the same instance across multiple imports", () => {
    let firstRef;
    let secondRef;
    jest.isolateModules(() => {
      firstRef = require("../src/vegaAgent").vegaAnalyticsHarvester;
      secondRef = require("../src/vegaAgent").vegaAnalyticsHarvester;
    });
    expect(firstRef).toBe(secondRef); // same reference within a module realm
  });

  // ====== T-VA-2 — inert constructor (no side effects) ======

  it("T-VA-2: constructor sets isInitialized=false, harvester=null, no setInterval, no fetch, no global write", () => {
    let agent;
    let setIntervalCalls = 0;
    let fetchCalls = 0;

    const realSetInterval = global.setInterval;
    global.setInterval = (...args) => {
      setIntervalCalls++;
      return realSetInterval(...args);
    };
    const trackingFetch = sinon.stub().resolves({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data_token: ["x"] }),
    });
    global.fetch = (...args) => {
      fetchCalls++;
      return trackingFetch(...args);
    };

    jest.isolateModules(() => {
      agent = require("../src/vegaAgent").vegaAnalyticsHarvester;
    });

    expect(agent.isInitialized).toBe(false);
    expect(agent.harvester).toBe(null);
    expect(setIntervalCalls).toBe(0);
    expect(fetchCalls).toBe(0);
    expect(globalThis.__NRVIDEO_VEGA__).toBeUndefined();

    global.setInterval = realSetInterval;
  });

  // ====== T-VA-3 — first addEvent triggers initialize ======

  it("T-VA-3: first addEvent triggers initialize() which reads globalThis.__NRVIDEO_VEGA__.info and constructs MobileHarvester; second addEvent does NOT re-initialize", () => {
    let agent;
    jest.isolateModules(() => {
      agent = require("../src/vegaAgent").vegaAnalyticsHarvester;
    });

    // Pre-populate the global slot (mimic what setVideoConfig does).
    globalThis.__NRVIDEO_VEGA__ = {
      info: {
        accountId: "acct",
        applicationToken: "tok-1",
        endpoint: "US",
      },
      config: { qoeAggregate: false, qoeIntervalFactor: 1 },
    };

    expect(agent.isInitialized).toBe(false);

    agent.addEvent({ actionName: "CONTENT_START" });
    expect(agent.isInitialized).toBe(true);
    const harvesterRef = agent.harvester;
    expect(harvesterRef).not.toBe(null);
    expect(harvesterRef.applicationToken).toBe("tok-1");

    // Second addEvent — same harvester, no re-init.
    agent.addEvent({ actionName: "CONTENT_PAUSE" });
    expect(agent.harvester).toBe(harvesterRef);

    agent.harvester.dispose();
  });

  // ====== T-VA-4 — defensive guard when info is missing ======

  it("T-VA-4: when globalThis.__NRVIDEO_VEGA__.info is missing on first addEvent, drops silently and does NOT flip isInitialized; subsequent addEvent (after info populated) initializes successfully", () => {
    let agent;
    jest.isolateModules(() => {
      agent = require("../src/vegaAgent").vegaAnalyticsHarvester;
    });

    // No global set.
    delete globalThis.__NRVIDEO_VEGA__;
    const result1 = agent.addEvent({ actionName: "CONTENT_START" });
    expect(result1).toBe(false);
    expect(agent.isInitialized).toBe(false);
    expect(agent.harvester).toBe(null);

    // Now populate the global and try again.
    globalThis.__NRVIDEO_VEGA__ = {
      info: { applicationToken: "tok-1", endpoint: "US" },
      config: {},
    };
    const result2 = agent.addEvent({ actionName: "CONTENT_START" });
    expect(agent.isInitialized).toBe(true);
    expect(agent.harvester).not.toBe(null);
    // result2 reflects the underlying MobileHarvester.addEvent return.
    expect(typeof result2).toBe("boolean");

    agent.harvester.dispose();
  });
});
