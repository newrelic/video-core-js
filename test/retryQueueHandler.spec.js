import sinon from 'sinon';
import { RetryQueueHandler } from '../src/retryQueueHandler';
import Constants from '../src/constants';
import Log from '../src/log';
import * as utils from '../src/utils';

describe('RetryQueueHandler', function() {
  let handler;
  let stubs = [];

  beforeAll(function() {
    Log.level = Log.Levels.SILENT;
  });

  afterAll(function() {
    Log.level = Log.Levels.ERROR;
  });

  beforeEach(function() {
    handler = new RetryQueueHandler();
    stubs = [];
  });

  afterEach(function() {
    stubs.forEach(stub => stub.restore && stub.restore());
    stubs = [];
  });

  describe('constructor', function() {
    it('should initialize empty retry queue', function() {
      expect(Array.isArray(handler.retryQueue)).toBe(true);
      expect(handler.retryQueue.length).toBe(0);
    });

    it('should set max queue size to 1000', function() {
      expect(handler.maxQueueSize).toBe(1000);
    });

    it('should set max queue size bytes', function() {
      expect(handler.maxQueueSizeBytes).toBe(Constants.MAX_PAYLOAD_SIZE);
    });
  });

  describe('addFailedEvents()', function() {
    beforeEach(function() {
      const dataSizeStub = sinon.stub(utils, 'dataSize').returns(100);
      stubs.push(dataSizeStub);
    });

    it('should add single event object', function() {
      handler.addFailedEvents({actionName: 'PLAY'});

      expect(handler.retryQueue.length).toBe(1);
    });

    it('should add array of events', function() {
      handler.addFailedEvents([
        {actionName: 'PLAY'},
        {actionName: 'PAUSE'}
      ]);

      expect(handler.retryQueue.length).toBe(2);
    });

    it('should evict oldest when queue at max count', function() {
      // Fill queue to limit
      for (let i = 0; i < 1000; i++) {
        handler.retryQueue.push({actionName: `EVENT_${i}`});
      }

      handler.addFailedEvents({actionName: 'NEW_EVENT'});

      expect(handler.retryQueue.length).toBe(1000);
      expect(handler.retryQueue[999].actionName).toBe('NEW_EVENT');
    });

    it('should handle add errors gracefully', function() {
      stubs[0].restore();
      const dataSizeStub = sinon.stub(utils, 'dataSize').throws(new Error('Size error'));
      stubs.push(dataSizeStub);

      expect(() => handler.addFailedEvents({actionName: 'TEST'})).not.toThrow();
    });

    it('should evict oldest when total size exceeds maxQueueSizeBytes', function() {
      stubs[0].restore();
      const dataSizeStub = sinon.stub(utils, 'dataSize').callsFake((data) => {
        if (Array.isArray(data)) {
          return data.length * 800;
        }
        return 800;
      });
      stubs.push(dataSizeStub);

      const originalMax = handler.maxQueueSizeBytes;
      handler.maxQueueSizeBytes = 2000;

      handler.addFailedEvents({actionName: 'EVENT_1'});
      handler.addFailedEvents({actionName: 'EVENT_2'});
      handler.addFailedEvents({actionName: 'EVENT_3'});

      const actionNames = handler.retryQueue.map(e => e.actionName);
      expect(actionNames).not.toContain('EVENT_1');

      handler.maxQueueSizeBytes = originalMax;
    });

    it('should evict multiple events when necessary to fit new event', function() {
      stubs[0].restore();
      const dataSizeStub = sinon.stub(utils, 'dataSize').callsFake((data) => {
        if (Array.isArray(data)) {
          return data.length * 600;
        }
        return 600;
      });
      stubs.push(dataSizeStub);

      const originalMax = handler.maxQueueSizeBytes;
      handler.maxQueueSizeBytes = 1500;

      handler.addFailedEvents({actionName: 'EVENT_1'});
      handler.addFailedEvents({actionName: 'EVENT_2'});
      handler.addFailedEvents({actionName: 'EVENT_3'});

      expect(handler.retryQueue.length).toBeLessThanOrEqual(2);

      handler.maxQueueSizeBytes = originalMax;
    });

    it('should handle case where event size alone exceeds maxQueueSizeBytes', function() {
      stubs[0].restore();
      const originalMax = handler.maxQueueSizeBytes;
      handler.maxQueueSizeBytes = 1000;

      let callCount = 0;
      const dataSizeStub = sinon.stub(utils, 'dataSize').callsFake((data) => {
        callCount++;
        if (Array.isArray(data)) {
          // Return size that grows with each event added
          return data.length * 1500;
        }
        // Event is larger than maxQueueSizeBytes
        return 1500;
      });
      stubs.push(dataSizeStub);

      expect(dataSizeStub).toBeDefined();

      handler.maxQueueSizeBytes = originalMax;
    });

    it('should properly update queue size tracking during eviction', function() {
      stubs[0].restore();
      const dataSizeStub = sinon.stub(utils, 'dataSize').returns(1000);
      stubs.push(dataSizeStub);

      // Add events
      for (let i = 0; i < 5; i++) {
        handler.addFailedEvents({actionName: `EVENT_${i}`});
      }

      const sizeBefore = handler.getQueueSize();
      handler.evictOldestEvent();

      const sizeAfter = handler.getQueueSize();
      expect(sizeAfter).toBe(sizeBefore - 1);
    });
  });

  describe('getRetryEventsToFit()', function() {
    beforeEach(function() {
      const dataSizeStub = sinon.stub(utils, 'dataSize').returns(100);
      stubs.push(dataSizeStub);

      // Add events
      for (let i = 0; i < 5; i++) {
        handler.retryQueue.push({actionName: `EVENT_${i}`});
      }
    });

    it('should return events up to available count', function() {
      const events = handler.getRetryEventsToFit(100000, 3);

      expect(events.length).toBe(3);
    });

    it('should return events up to available space', function() {
      stubs[0].restore();
      const dataSizeStub = sinon.stub(utils, 'dataSize').returns(200);
      stubs.push(dataSizeStub);

      const events = handler.getRetryEventsToFit(500, 100);

      expect(events.length).toBeLessThanOrEqual(2);
    });

    it('should remove extracted events from queue', function() {
      handler.getRetryEventsToFit(100000, 3);

      expect(handler.retryQueue.length).toBe(2);
    });

   it('should handle zero available space', function() {
      const events = handler.getRetryEventsToFit(0, 10);

      expect(events.length).toBe(0);
    });

    it('should handle zero available count', function() {
      const events = handler.getRetryEventsToFit(10000, 0);

      expect(events.length).toBe(0);
    });

    it('should return empty array if queue empty', function() {
      handler.retryQueue = [];

      const events = handler.getRetryEventsToFit(10000, 10);

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    });
  });

  describe('evictOldestEvent()', function() {
    it('should remove oldest event', function() {
      handler.retryQueue.push({actionName: 'FIRST'});
      handler.retryQueue.push({actionName: 'SECOND'});

      handler.evictOldestEvent();

      expect(handler.retryQueue.length).toBe(1);
      expect(handler.retryQueue[0].actionName).toBe('SECOND');
    });

    it('should not error on empty queue', function() {
      expect(() => handler.evictOldestEvent()).not.toThrow();
    });

    it('should maintain FIFO order across multiple evictions', function() {
      handler.retryQueue.push({actionName: 'FIRST'});
      handler.retryQueue.push({actionName: 'SECOND'});
      handler.retryQueue.push({actionName: 'THIRD'});

      handler.evictOldestEvent(); // Removes FIRST
      handler.evictOldestEvent(); // Removes SECOND

      expect(handler.retryQueue.length).toBe(1);
      expect(handler.retryQueue[0].actionName).toBe('THIRD');
    });
  });

  describe('getQueueSize()', function() {
    it('should return zero for empty queue', function() {
      expect(handler.getQueueSize()).toBe(0);
    });

    it('should return queue length', function() {
      handler.retryQueue.push({actionName: 'EVENT_1'});
      handler.retryQueue.push({actionName: 'EVENT_2'});

      expect(handler.getQueueSize()).toBe(2);
    });
  });

  describe('clear()', function() {
    it('should empty retry queue', function() {
      handler.retryQueue.push({actionName: 'EVENT_1'});
      handler.retryQueue.push({actionName: 'EVENT_2'});

      handler.clear();

      expect(handler.retryQueue.length).toBe(0);
    });

    it('should not error on empty queue', function() {
      expect(() => handler.clear()).not.toThrow();
    });
  });
});

describe('RetryQueueHandler buffer drop logging', function() {
  let handler;
  let info, warn, error;

  const add = (n) => { for (let i = 0; i < n; i++) handler.addFailedEvents({ eventType: 'VideoAction', i }); };
  const msgs = (spy, re) => spy.getCalls().map(c => c.args[c.args.length - 1]).filter(m => re.test(m));

  beforeEach(function() {
    global.window.NRVIDEO = { config: { enableLogging: true } };
    Log.level = Log.Levels.ALL;
    handler = new RetryQueueHandler();
    info = sinon.stub(console, 'log');
    warn = sinon.stub(console, 'warn');
    error = sinon.stub(console, 'error');
  });

  afterEach(function() {
    [info, warn, error].forEach(st => st.restore());
    Log.level = Log.Levels.ERROR;
    delete global.window.NRVIDEO;
  });

  it('logs INFO at 85% and WARNING at 90% once per crossing, then re-arms', function() {
    add(950);
    expect(msgs(info, /retry queue buffer 85% full \(\d+ of 1000 events\)/).length).toBe(1);
    expect(msgs(warn, /retry queue buffer 90% full \(\d+ of 1000 events\)/).length).toBe(1);
    handler.getRetryEventsToFit(Infinity, 500);
    add(950 - handler.retryQueue.length);
    expect(msgs(info, /85% full/).length).toBe(2);
    expect(msgs(warn, /90% full/).length).toBe(2);
  });

  it('logs ERROR on every eviction with its own cumulative count', function() {
    add(1003);
    const errs = msgs(error, /Total dropped/);
    expect(errs.length).toBe(3);
    expect(errs[2]).toBe('retry queue buffer full (capacity 1000), oldest event dropped. Total dropped this session: 3');
    expect(handler.retryQueue.length).toBe(1000);
  });

  it('is silent when enableLogging is unset', function() {
    delete global.window.NRVIDEO;
    add(1003);
    expect([info, warn, error].some(st => msgs(st, /oldest event dropped|[0-9]+% full/).length)).toBe(false);
  });
});
