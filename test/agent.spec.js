import sinon from 'sinon';
import { videoAnalyticsHarvester } from '../src/browser/agent';
import Log from '../src/log';
import { JSDOM } from "jsdom";
import { HarvestScheduler } from '../src/browser/harvestScheduler';

describe('videoAnalyticsHarvester', function() {
  let stubs = [];

  beforeAll(function() {
    Log.level = Log.Levels.SILENT;

    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    global.window = dom.window;
    global.document = dom.window.document;

    if (!videoAnalyticsHarvester.isInitialized) {
      videoAnalyticsHarvester.initialize();
    }
  });

  afterAll(function() {
    Log.level = Log.Levels.ERROR;

    if (videoAnalyticsHarvester.harvestScheduler) {
      videoAnalyticsHarvester.harvestScheduler.stopScheduler();
    }

    delete global.document;
    delete global.window;
  });

  afterEach(function() {
    stubs.forEach(stub => stub.restore && stub.restore());
    stubs = [];
  });

  describe('initialization', function() {
    
    it('should auto-initialize when addEvent called on uninitialized agent', function() {
      videoAnalyticsHarvester.isInitialized = false;
      videoAnalyticsHarvester.eventBuffer = null;

      const warnStub = sinon.stub(Log, 'warn');
      stubs.push(warnStub);

      videoAnalyticsHarvester.addEvent({actionName: 'TEST'});

      expect(warnStub.calledWith('Video analytics agent not initialized, initializing now')).toBe(true);
      expect(videoAnalyticsHarvester.isInitialized).toBe(true);
    });

    it('should handle initialization errors gracefully', function() {
      videoAnalyticsHarvester.isInitialized = false;
      videoAnalyticsHarvester.eventBuffer = null;
      videoAnalyticsHarvester.harvestScheduler = null;

      const errorStub = sinon.stub(Log, 'error');
      stubs.push(errorStub);

      const schedulerStub = sinon.stub(HarvestScheduler.prototype, 'startScheduler').throws(new Error('Scheduler error'));
      stubs.push(schedulerStub);

      videoAnalyticsHarvester.initialize();

      expect(errorStub.called).toBe(true);
      expect(errorStub.firstCall.args[0]).toContain('Failed to initialize');
    });
  });

  describe('addEvent()', function() {
    beforeEach(function() {
      if (videoAnalyticsHarvester.eventBuffer) {
        videoAnalyticsHarvester.eventBuffer.clear();
      }
    });

    it('should handle QOE_AGGREGATE events specially', function() {
      const qoe1 = {actionName: 'QOE_AGGREGATE', value: 1};
      const qoe2 = {actionName: 'QOE_AGGREGATE', value: 2};

      videoAnalyticsHarvester.addEvent(qoe1);
      videoAnalyticsHarvester.addEvent(qoe2);

      // Should only have 1 QOE event (replaced, not added)
      expect(videoAnalyticsHarvester.eventBuffer.size()).toBe(1);
    });

    it('should return false when addEvent fails', function() {
      const addStub = sinon.stub(videoAnalyticsHarvester.eventBuffer, 'add').throws(new Error('Add error'));
      stubs.push(addStub);

      const result = videoAnalyticsHarvester.addEvent({actionName: 'ERROR_TEST'});

      expect(result).toBe(false);
    });
  });

  describe('setHarvestInterval()', function() {
    it('should auto-initialize when called on uninitialized agent', function() {
      videoAnalyticsHarvester.isInitialized = false;

      videoAnalyticsHarvester.setHarvestInterval(10000);

      expect(videoAnalyticsHarvester.isInitialized).toBe(true);
    });

    it('should update harvest scheduler interval', function() {
      videoAnalyticsHarvester.setHarvestInterval(20000);

      expect(videoAnalyticsHarvester.harvestScheduler.harvestCycle).toBe(20000);
    });
  });

  describe('forceNextQoeCycle()', function() {
    it('should set forceNextQoeCycle flag on harvest scheduler', function() {
      expect(videoAnalyticsHarvester.harvestScheduler.forceNextQoeCycle).toBe(false);

      videoAnalyticsHarvester.forceNextQoeCycle();

      expect(videoAnalyticsHarvester.harvestScheduler.forceNextQoeCycle).toBe(true);
    });
  });

  describe('QOE_AGGREGATE buffer management', function() {
    beforeEach(function() {
      if (videoAnalyticsHarvester.eventBuffer) {
        videoAnalyticsHarvester.eventBuffer.clear();
      }
    });

    it('should always replace QOE_AGGREGATE in buffer (dedup happens at drain time)', function() {
      const qoe1 = {actionName: 'QOE_AGGREGATE', totalPlaytime: 1000, peakBitrate: 2000};
      const qoe2 = {actionName: 'QOE_AGGREGATE', totalPlaytime: 1000, peakBitrate: 2000, timestamp: 9999};

      videoAnalyticsHarvester.addEvent(qoe1);
      videoAnalyticsHarvester.addEvent(qoe2);

      const events = videoAnalyticsHarvester.eventBuffer.drain();
      expect(events.length).toBe(1);
      // Should have the latest event (replaced)
      expect(events[0].timestamp).toBe(9999);
    });

    it('should replace QOE_AGGREGATE when KPIs differ', function() {
      const qoe1 = {actionName: 'QOE_AGGREGATE', totalPlaytime: 1000};
      const qoe2 = {actionName: 'QOE_AGGREGATE', totalPlaytime: 5000};

      videoAnalyticsHarvester.addEvent(qoe1);
      videoAnalyticsHarvester.addEvent(qoe2);

      const events = videoAnalyticsHarvester.eventBuffer.drain();
      expect(events.length).toBe(1);
      expect(events[0].totalPlaytime).toBe(5000);
    });
  });

  describe('setBeforeDrainCallback()', function() {
    it('should set beforeDrainCallback on harvest scheduler', function() {
      const callback = function() {};
      videoAnalyticsHarvester.setBeforeDrainCallback(callback);

      expect(videoAnalyticsHarvester.harvestScheduler.beforeDrainCallback).toBe(callback);
    });
  });

  describe('refreshQoeKpis()', function() {
    beforeEach(function() {
      if (videoAnalyticsHarvester.eventBuffer) {
        videoAnalyticsHarvester.eventBuffer.clear();
      }
    });

    it('should update KPI fields on existing QOE_AGGREGATE in buffer', function() {
      const qoe = {actionName: 'QOE_AGGREGATE', totalPlaytime: 1000, peakBitrate: 2000};
      videoAnalyticsHarvester.addEvent(qoe);

      // Refresh with updated KPIs
      videoAnalyticsHarvester.refreshQoeKpis({totalPlaytime: 5000, peakBitrate: 3000});

      const events = videoAnalyticsHarvester.eventBuffer.drain();
      expect(events.length).toBe(1);
      expect(events[0].totalPlaytime).toBe(5000);
      expect(events[0].peakBitrate).toBe(3000);
      // actionName should be preserved
      expect(events[0].actionName).toBe('QOE_AGGREGATE');
    });

    it('should do nothing if no QOE_AGGREGATE exists in buffer', function() {
      videoAnalyticsHarvester.addEvent({actionName: 'PLAY'});

      // Should not throw
      videoAnalyticsHarvester.refreshQoeKpis({totalPlaytime: 5000});

      const events = videoAnalyticsHarvester.eventBuffer.drain();
      expect(events.length).toBe(1);
      expect(events[0].actionName).toBe('PLAY');
    });
  });
});
