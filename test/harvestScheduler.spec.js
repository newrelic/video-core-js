import sinon from 'sinon';
import { HarvestScheduler } from '../src/harvestScheduler';
import { NrVideoEventAggregator } from '../src/eventAggregator';
import { RetryQueueHandler } from '../src/retryQueueHandler';
import Constants from '../src/constants';
import Log from '../src/log';
import * as utils from '../src/utils';
import { JSDOM } from 'jsdom';

describe('HarvestScheduler', function() {
  let scheduler;
  let mockEventBuffer;
  let clock;
  let stubs = [];

  beforeAll(function() {
    Log.level = Log.Levels.SILENT;
  });

  afterAll(function() {
    Log.level = Log.Levels.ERROR;
  });

  beforeEach(function() {
    clock = sinon.useFakeTimers();

    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    global.window = dom.window;
    global.document = dom.window.document;

    global.window.NRVIDEO = {
      info: {
        region: 'US',
        beacon: 'bam.nr-data.net',
        licenseKey: 'test-key'
      }
    };

    mockEventBuffer = {
      size: sinon.stub().returns(5),
      isEmpty: sinon.stub().returns(false),
      drain: sinon.stub().returns([{actionName: 'PLAY'}, {actionName: 'PAUSE'}]),
      setSmartHarvestCallback: sinon.stub()
    };

    stubs = [];
  });

  afterEach(function() {
    stubs.forEach(stub => stub.restore && stub.restore());
    stubs = [];
    clock.restore();
    delete global.window;
    delete global.document;
  });

  describe('scheduler lifecycle', function() {
    beforeEach(function() {
      scheduler = new HarvestScheduler(mockEventBuffer);
    });

    it('should manage start, stop, and restart lifecycle with state validation', function() {
      // Start successfully
      scheduler.startScheduler();
      expect(scheduler.isStarted).toBe(true);
      expect(scheduler.currentTimerId).not.toBeNull();
      const firstTimerId = scheduler.currentTimerId;

      // Prevent double start
      const logSpy = sinon.spy(Log, 'warn');
      stubs.push(logSpy);
      scheduler.startScheduler();
      expect(logSpy.calledWith('Harvest scheduler is already started')).toBe(true);
      expect(scheduler.currentTimerId).toBe(firstTimerId);

      // Stop and clear timer
      scheduler.stopScheduler();
      expect(scheduler.isStarted).toBe(false);
      expect(scheduler.currentTimerId).toBeNull();

      // Allow restart
      scheduler.startScheduler();
      expect(scheduler.isStarted).toBe(true);
      expect(scheduler.currentTimerId).not.toBeNull();
    });

    it('should handle edge cases for stopping and scheduling', function() {
      // Stop unstarted scheduler
      expect(() => scheduler.stopScheduler()).not.toThrow();

      // Handle stopScheduler when currentTimerId is null but isStarted is true
      scheduler.isStarted = true;
      scheduler.currentTimerId = null;
      scheduler.stopScheduler();
      expect(scheduler.isStarted).toBe(false);

      // Not schedule when not started
      scheduler.scheduleNextHarvest();
      expect(scheduler.currentTimerId).toBeNull();
    });

    it('should start scheduler with null eventBuffer', function() {
      scheduler = new HarvestScheduler(null);
      scheduler.startScheduler();
      expect(scheduler.isStarted).toBe(true);
      expect(scheduler.currentTimerId).not.toBeNull();
    });
  });

  describe('triggerSmartHarvest()', function() {
    beforeEach(function() {
      scheduler = new HarvestScheduler(mockEventBuffer);
      scheduler.startScheduler();
    });

    it('should handle smart harvest lifecycle with scheduling', async function() {
      const triggerHarvestStub = sinon.stub(scheduler, 'triggerHarvest').resolves({success: true});
      stubs.push(triggerHarvestStub);

      // Trigger harvest and reschedule
      await scheduler.triggerSmartHarvest('smart', 60);
      expect(triggerHarvestStub.calledOnce).toBe(true);
      expect(scheduler.currentTimerId).not.toBeNull();

      // Not trigger when buffer is empty
      mockEventBuffer.isEmpty.returns(true);
      await scheduler.triggerSmartHarvest('smart', 60);
      expect(triggerHarvestStub.calledOnce).toBe(true);
    });

    it('should handle errors and stopped scheduler state', async function() {
      const triggerHarvestStub = sinon.stub(scheduler, 'triggerHarvest').rejects(new Error('Test error'));
      stubs.push(triggerHarvestStub);

      // Handle errors and reschedule
      await scheduler.triggerSmartHarvest('smart', 60);
      expect(scheduler.currentTimerId).not.toBeNull();

      // Not reschedule when stopped
      scheduler.stopScheduler();
      await scheduler.triggerSmartHarvest('overflow', 90);
      expect(scheduler.currentTimerId).toBeNull();
    });
  });

  describe('onHarvestInterval()', function() {
    beforeEach(function() {
      scheduler = new HarvestScheduler(mockEventBuffer);
      scheduler.startScheduler();
    });

    it('should conditionally trigger harvest based on data availability', async function() {
      const triggerHarvestStub = sinon.stub(scheduler, 'triggerHarvest').resolves({success: true});
      stubs.push(triggerHarvestStub);

      // Trigger when buffer has data
      clock.tick(Constants.INTERVAL);
      await Promise.resolve();
      expect(triggerHarvestStub.called).toBe(true);
      expect(scheduler.currentTimerId).not.toBeNull();

      // Not trigger when both buffer and retry queue are empty
      triggerHarvestStub.reset();
      mockEventBuffer.isEmpty.returns(true);
      scheduler.retryQueueHandler.getQueueSize = sinon.stub().returns(0);
      clock.tick(Constants.INTERVAL);
      await Promise.resolve();
      expect(triggerHarvestStub.called).toBe(false);

      // Trigger when retry queue has data
      scheduler.retryQueueHandler.getQueueSize.returns(10);
      clock.tick(Constants.INTERVAL);
      await Promise.resolve();
      expect(triggerHarvestStub.called).toBe(true);
    });

    it('should handle harvest errors', async function() {
      const triggerHarvestStub = sinon.stub(scheduler, 'triggerHarvest').rejects(new Error('Harvest failed'));
      stubs.push(triggerHarvestStub);

      const logStub = sinon.stub(Log, 'error');
      stubs.push(logStub);

      clock.tick(Constants.INTERVAL);
      await Promise.resolve();
      expect(logStub.calledOnce).toBe(true);
    });
  });

  describe('triggerHarvest()', function() {
    beforeEach(function() {
      scheduler = new HarvestScheduler(mockEventBuffer);
      sinon.stub(scheduler.httpClient, 'send').callsFake((opts, cb) => {
        cb({retry: false, status: 200});
      });
    });

    it('should handle harvest lifecycle and state management', async function() {
      // Reject when already in progress
      scheduler.isHarvesting = true;
      let result = await scheduler.triggerHarvest();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('harvest_in_progress');

      // Successfully harvest and send events
      scheduler.isHarvesting = false;
      result = await scheduler.triggerHarvest();
      expect(mockEventBuffer.drain.called).toBe(true);
      expect(scheduler.httpClient.send.called).toBe(true);
      expect(result.success).toBe(true);
      expect(result.totalChunks).toBe(1);
      expect(scheduler.isHarvesting).toBe(false);

      // Handle harvest errors gracefully
      mockEventBuffer.drain.throws(new Error('Test error'));
      await scheduler.triggerHarvest();
      expect(scheduler.isHarvesting).toBe(false);
    });

    it('should handle final harvest event trimming', async function() {
      mockEventBuffer.drain = sinon.stub().returns([{actionName: 'PLAY'}]);

      // Trim when exceeding beacon size
      let dataSizeStub = sinon.stub(utils, 'dataSize').returns(Constants.MAX_BEACON_SIZE + 1000);
      stubs.push(dataSizeStub);
      let trimSpy = sinon.spy(scheduler, 'trimEventsToFit');
      stubs.push(trimSpy);

      await scheduler.triggerHarvest({isFinalHarvest: true});
      expect(trimSpy.calledOnce).toBe(true);

      // Not trim when within beacon size
      dataSizeStub.restore();
      trimSpy.restore();
      dataSizeStub = sinon.stub(utils, 'dataSize').returns(1000);
      stubs.push(dataSizeStub);
      trimSpy = sinon.spy(scheduler, 'trimEventsToFit');
      stubs.push(trimSpy);

      await scheduler.triggerHarvest({isFinalHarvest: true});
      expect(trimSpy.called).toBe(false);
    });

    it('should handle request failure', async function() {
      scheduler.httpClient.send.restore();
      sinon.stub(scheduler.httpClient, 'send').callsFake((_opts, cb) => {
        cb({retry: true, status: 500});
      });

      const handleFailureStub = sinon.stub(scheduler, 'handleRequestFailure');
      stubs.push(handleFailureStub);

      await scheduler.triggerHarvest();
      expect(handleFailureStub.called).toBe(true);
    });
  });

  describe('drainEvents()', function() {
    beforeEach(function() {
      scheduler = new HarvestScheduler(mockEventBuffer);
      scheduler.retryQueueHandler.getQueueSize = sinon.stub().returns(0);
    });

    it('should drain events with retry queue integration', function() {
      // Include retry events when available
      scheduler.retryQueueHandler.getQueueSize.returns(5);
      scheduler.retryQueueHandler.getRetryEventsToFit = sinon.stub().returns([{actionName: 'RETRY1'}]);

      let events = scheduler.drainEvents();
      expect(mockEventBuffer.drain.called).toBe(true);
      expect(events.length).toBeGreaterThan(2);
      expect(events[0].actionName).toBe('RETRY1');

      // Skip retry events when payload is full
      const dataSizeStub = sinon.stub(utils, 'dataSize').returns(Constants.MAX_PAYLOAD_SIZE);
      stubs.push(dataSizeStub);
      scheduler.retryQueueHandler.getRetryEventsToFit = sinon.stub();
      scheduler.drainEvents();
      expect(scheduler.retryQueueHandler.getRetryEventsToFit.called).toBe(false);

      // Handle empty retry queue results
      dataSizeStub.restore();
      scheduler.retryQueueHandler.getRetryEventsToFit = sinon.stub().returns([]);
      events = scheduler.drainEvents();
      expect(events.length).toBe(2);
      expect(events[0].actionName).toBe('PLAY');
    });
  });

  describe('trimEventsToFit()', function() {
    beforeEach(function() {
      scheduler = new HarvestScheduler(mockEventBuffer);
    });

    it('should trim events and handle retry queue', function() {
      // Handle empty arrays
      scheduler.retryQueueHandler = null;
      let trimmed = scheduler.trimEventsToFit([], 1000);
      expect(trimmed).toEqual([]);

      // Trim events when retryQueueHandler is null
      const multiEvents = [{actionName: 'OLD'}, {actionName: 'MIDDLE'}, {actionName: 'RECENT'}];
      let dataSizeStub = sinon.stub(utils, 'dataSize');
      stubs.push(dataSizeStub);
      dataSizeStub.onCall(0).returns(100);
      dataSizeStub.onCall(1).returns(200);
      dataSizeStub.onCall(2).returns(200);

      const logStub = sinon.stub(Log, 'warn');
      stubs.push(logStub);

      trimmed = scheduler.trimEventsToFit(multiEvents, 150);
      expect(trimmed.length).toBe(1);
      expect(trimmed[0].actionName).toBe('RECENT');
      expect(logStub.called).toBe(true);

      // Handle within-limit events and trimming with retry queue
      scheduler.retryQueueHandler = new RetryQueueHandler();
      dataSizeStub.restore();
      dataSizeStub = sinon.stub(utils, 'dataSize').returns(1000);
      stubs.push(dataSizeStub);

      const events = [{actionName: 'PLAY'}];
      trimmed = scheduler.trimEventsToFit(events, 5000);
      expect(trimmed).toEqual(events);

      // Trim with retry queue
      dataSizeStub.restore();
      dataSizeStub = sinon.stub(utils, 'dataSize');
      stubs.push(dataSizeStub);
      dataSizeStub.onCall(0).returns(100);
      dataSizeStub.onCall(1).returns(200);
      dataSizeStub.onCall(2).returns(200);

      const addFailedSpy = sinon.spy(scheduler.retryQueueHandler, 'addFailedEvents');
      trimmed = scheduler.trimEventsToFit(multiEvents, 150);
      expect(trimmed.length).toBe(1);
      expect(trimmed[0].actionName).toBe('RECENT');
      expect(addFailedSpy.called).toBe(true);
    });
  });

  describe('updateHarvestInterval()', function() {
    beforeEach(function() {
      scheduler = new HarvestScheduler(mockEventBuffer);
    });

    it('should update interval with validation', function() {
      scheduler.startScheduler();
      const oldTimerId = scheduler.currentTimerId;

      // Update interval and restart timer
      scheduler.updateHarvestInterval(15000);
      expect(scheduler.harvestCycle).toBe(15000);
      expect(scheduler.currentTimerId).not.toBe(oldTimerId);

      // Reject below minimum
      scheduler.updateHarvestInterval(500);
      expect(scheduler.harvestCycle).toBe(15000);

      // Reject above maximum
      scheduler.updateHarvestInterval(400000);
      expect(scheduler.harvestCycle).toBe(15000);

      // Reject invalid type
      scheduler.updateHarvestInterval('invalid');
      expect(scheduler.harvestCycle).toBe(15000);
    });

    it('should handle edge cases for interval updates', function() {
      scheduler.startScheduler();

      // Handle NaN
      scheduler.updateHarvestInterval(NaN);
      expect(isNaN(scheduler.harvestCycle)).toBe(true);

      // Not restart when unchanged
      scheduler.harvestCycle = 20000;
      scheduler.startScheduler();
      const timerId = scheduler.currentTimerId;
      scheduler.updateHarvestInterval(20000);
      expect(scheduler.currentTimerId).toBe(timerId);

      // Not schedule when stopped
      scheduler.stopScheduler();
      scheduler.updateHarvestInterval(25000);
      expect(scheduler.currentTimerId).toBeNull();
    });
  });

  describe('failover logic', function() {
    beforeEach(function() {
      scheduler = new HarvestScheduler(mockEventBuffer);
      scheduler.retryQueueHandler.addFailedEvents = sinon.stub();
    });

    it('should handle US region failover with retry count management', function() {
      global.window.NRVIDEO.info.region = 'US';

      // Increment on first failure
      scheduler.handleRequestFailure([{actionName: 'TEST'}]);
      expect(scheduler.retryCount).toBe(1);

      // Switch to fallback after 2 failures
      scheduler.handleRequestFailure([{actionName: 'TEST'}]);
      expect(scheduler.fallBackUrl).toBe(Constants.COLLECTOR['US'][1]);

      // Reset after 6 failures
      for (let i = 0; i < 4; i++) {
        scheduler.handleRequestFailure([{actionName: 'TEST'}]);
      }
      expect(scheduler.retryCount).toBe(0);
      expect(scheduler.fallBackUrl).toBe('');
    });

    it('should not use fallback URL for non-US regions', function() {
      global.window.NRVIDEO.info.region = 'EU';
      const events = [{actionName: 'FAILED'}];
      scheduler.handleRequestFailure(events);
      scheduler.handleRequestFailure(events);

      expect(scheduler.fallBackUrl).toBe('');
      expect(scheduler.retryQueueHandler.addFailedEvents.calledWith(events)).toBe(true);
    });
  });

  describe('page lifecycle handlers', function() {
    it('should handle visibility changes, pagehide, and beforeunload', function() {
      const docSpy = sinon.spy(global.document, 'addEventListener');
      const winSpy = sinon.spy(global.window, 'addEventListener');
      stubs.push(docSpy, winSpy);

      scheduler = new HarvestScheduler(mockEventBuffer);
      const triggerStub = sinon.stub(scheduler, 'triggerHarvest');
      stubs.push(triggerStub);

      const visibilityCall = docSpy.getCalls().find(call => call.args[0] === 'visibilitychange');
      const visibilityHandler = visibilityCall.args[1];

      Object.defineProperty(global.document, 'hidden', {
        writable: true,
        configurable: true,
        value: true
      });

      visibilityHandler();
      expect(triggerStub.calledOnce).toBe(true);
      expect(triggerStub.firstCall.args[0].isFinalHarvest).toBe(true);

      visibilityHandler();
      expect(triggerStub.calledOnce).toBe(true);
      expect(triggerStub.firstCall.args[0].isFinalHarvest).toBe(true);

      visibilityHandler();
      expect(triggerStub.calledOnce).toBe(true);

      Object.defineProperty(global.document, 'hidden', {value: false});
      visibilityHandler();
      expect(triggerStub.calledOnce).toBe(true);

      const pagehideCall = winSpy.getCalls().find(call => call.args[0] === 'pagehide');
      const beforeunloadCall = winSpy.getCalls().find(call => call.args[0] === 'beforeunload');

      expect(pagehideCall).toBeDefined();
      expect(beforeunloadCall).toBeDefined();

      pagehideCall.args[1]();
      expect(triggerStub.calledOnce).toBe(true);

      beforeunloadCall.args[1]();
      expect(triggerStub.calledOnce).toBe(true);
    });
  });

  describe('smart harvest callback', function() {
    it('should trigger smart harvest when callback is invoked', async function() {
      const dataSizeStub = sinon.stub(utils, 'dataSize').returns(100000);
      stubs.push(dataSizeStub);

      const realEventBuffer = new NrVideoEventAggregator();
      scheduler = new HarvestScheduler(realEventBuffer);

      const triggerStub = sinon.stub(scheduler, 'triggerSmartHarvest');
      stubs.push(triggerStub);

      scheduler.startScheduler();

      for (let i = 0; i < 7; i++) {
        realEventBuffer.add({ actionName: `EVENT_${i}`, data: 'test' });
      }

      expect(triggerStub.called).toBe(true);
      expect(triggerStub.firstCall.args[0]).toBe('smart');
      expect(triggerStub.firstCall.args[1]).toBe(60);
    });
  });
});
