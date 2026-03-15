import sinon from 'sinon';
import { videoAnalyticsHarvester } from '../src/agent';
import Log from '../src/log';
import { JSDOM } from "jsdom";
import { HarvestScheduler } from '../src/harvestScheduler.js';

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

    it('should add all events to buffer equally (QoE handled by provider)', function() {
      const event1 = {actionName: 'CONTENT_HEARTBEAT', value: 1};
      const event2 = {actionName: 'CONTENT_HEARTBEAT', value: 2};

      videoAnalyticsHarvester.addEvent(event1);
      videoAnalyticsHarvester.addEvent(event2);

      // Both events added — QoE is now produced at harvest time, not in buffer
      expect(videoAnalyticsHarvester.eventBuffer.size()).toBe(2);
    });

    it('should return false when addEvent fails', function() {
      const addStub = sinon.stub(videoAnalyticsHarvester.eventBuffer, 'add').throws(new Error('Add error'));
      stubs.push(addStub);

      const result = videoAnalyticsHarvester.addEvent({actionName: 'ERROR_TEST'});

      expect(result).toBe(false);
    });
  });

  describe('setQoeProvider()', function() {
    it('should register provider on harvest scheduler', function() {
      const provider = () => null;

      videoAnalyticsHarvester.setQoeProvider(provider);

      expect(videoAnalyticsHarvester.harvestScheduler.qoeProvider).toBe(provider);
    });

    it('should auto-initialize when called on uninitialized agent', function() {
      videoAnalyticsHarvester.isInitialized = false;

      videoAnalyticsHarvester.setQoeProvider(() => null);

      expect(videoAnalyticsHarvester.isInitialized).toBe(true);
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
});
