import sinon from 'sinon';
import { NrVideoEventAggregator } from '../src/eventAggregator';
import Constants from '../src/constants';
import Log from '../src/log';
import * as utils from '../src/utils';

describe('NrVideoEventAggregator', function() {
  let aggregator;
  let stubs = [];

  beforeAll(function() {
    Log.level = Log.Levels.SILENT;
  });

  afterAll(function() {
    Log.level = Log.Levels.ERROR;
  });

  beforeEach(function() {
    aggregator = new NrVideoEventAggregator();
    stubs = [];
  });

  afterEach(function() {
    stubs.forEach(stub => stub.restore && stub.restore());
    stubs = [];
  });

  describe('add()', function() {
    it('should add events and update counters', function() {
      const dataSizeStub = sinon.stub(utils, 'dataSize');
      stubs.push(dataSizeStub);
      dataSizeStub.onCall(0).returns(100);
      dataSizeStub.onCall(1).returns(200);

      aggregator.add({actionName: 'PLAY'});
      expect(aggregator.buffer.length).toBe(1);
      expect(aggregator.totalEvents).toBe(1);
      expect(aggregator.currentPayloadSize).toBe(100);

      aggregator.add({actionName: 'PAUSE'});
      expect(aggregator.buffer.length).toBe(2);
      expect(aggregator.totalEvents).toBe(2);
      expect(aggregator.currentPayloadSize).toBe(300);
    });

    it('should replace event at index without incrementing totalEvents', function() {
      const dataSizeStub = sinon.stub(utils, 'dataSize');
      stubs.push(dataSizeStub);
      dataSizeStub.onCall(0).returns(100);
      dataSizeStub.onCall(1).returns(200);
      dataSizeStub.onCall(2).returns(100);

      aggregator.add({actionName: 'PLAY', value: 1});
      expect(aggregator.totalEvents).toBe(1);

      aggregator.add({actionName: 'PLAY', value: 2}, 0);
      expect(aggregator.totalEvents).toBe(1);
      expect(aggregator.buffer[0].value).toBe(2);
      expect(aggregator.currentPayloadSize).toBe(200);
    });

    it('should call makeRoom when exceeding max payload or event count', function() {
      const dataSizeStub = sinon.stub(utils, 'dataSize').returns(Constants.MAX_PAYLOAD_SIZE);
      stubs.push(dataSizeStub);

      const makeRoomSpy = sinon.spy(aggregator, 'makeRoom');
      stubs.push(makeRoomSpy);

      aggregator.currentPayloadSize = Constants.MAX_PAYLOAD_SIZE - 100;
      aggregator.add({actionName: 'LARGE'});
      expect(makeRoomSpy.calledOnce).toBe(true);

      makeRoomSpy.reset();
      aggregator.totalEvents = Constants.MAX_EVENTS_PER_BATCH - 1;
      aggregator.add({actionName: 'OVERFLOW'});
      expect(makeRoomSpy.called).toBe(true);
    });

    it('should handle errors', function() {
      const dataSizeStub = sinon.stub(utils, 'dataSize').throws(new Error('Test error'));
      stubs.push(dataSizeStub);

      const result = aggregator.add({actionName: 'PLAY'});
      expect(result).toBe(false);
    });
  });

  describe('addOrReplaceByActionName()', function() {
    beforeEach(function() {
      const dataSizeStub = sinon.stub(utils, 'dataSize').returns(100);
      stubs.push(dataSizeStub);
    });

    it('should add event if actionName not found', function() {
      const result = aggregator.addOrReplaceByActionName('QOE', {actionName: 'QOE', data: 1});

      expect(result).toBe(true);
      expect(aggregator.buffer.length).toBe(1);
    });

    it('should replace existing event if actionName found', function() {
      aggregator.add({actionName: 'PLAY'});
      aggregator.add({actionName: 'QOE', value: 1});
      aggregator.add({actionName: 'PAUSE'});

      aggregator.addOrReplaceByActionName('QOE', {actionName: 'QOE', value: 2});

      expect(aggregator.buffer.length).toBe(3);
      expect(aggregator.buffer[1].value).toBe(2);
    });

    it('should return false on error', function() {
      const addStub = sinon.stub(aggregator, 'add').throws(new Error('Test error'));
      stubs.push(addStub);

      const result = aggregator.addOrReplaceByActionName('TEST', {actionName: 'TEST'});
      expect(result).toBe(false);
    });
  });

  describe('checkSmartHarvestTrigger()', function() {
    it('should not trigger for below thresholds', function() {
      const callback = sinon.spy();
      aggregator.setSmartHarvestCallback(callback);

      aggregator.currentPayloadSize = 100;
      aggregator.totalEvents = 10;
      aggregator.checkSmartHarvestTrigger();

      expect(callback.called).toBe(false);
    });

    it('should trigger smart harvest at 60% event count threshold', function() {
      const callback = sinon.spy();
      aggregator.setSmartHarvestCallback(callback);

      aggregator.currentPayloadSize = 100;
      aggregator.totalEvents = aggregator.smartHarvestEventThreshold + 1;
      aggregator.checkSmartHarvestTrigger();

      expect(callback.calledWith('smart', 60)).toBe(true);
    });

    it('should trigger overflow harvest at 90% thresholds with priority', function() {
      const callback = sinon.spy();
      aggregator.setSmartHarvestCallback(callback);

      aggregator.currentPayloadSize = aggregator.overflowPayloadThreshold + 1;
      aggregator.totalEvents = aggregator.overflowEventThreshold + 1;
      aggregator.checkSmartHarvestTrigger();

      expect(callback.calledOnce).toBe(true);
      expect(callback.calledWith('overflow', 90)).toBe(true);
    });

    it('should trigger overflow harvest when event count threshold reached', function() {
      const callback = sinon.spy();
      aggregator.setSmartHarvestCallback(callback);

      aggregator.currentPayloadSize = 100; // Below threshold
      aggregator.totalEvents = aggregator.overflowEventThreshold + 1; // Above threshold
      aggregator.checkSmartHarvestTrigger();

      expect(callback.calledOnce).toBe(true);
      expect(callback.calledWith('overflow', 90)).toBe(true);
    });

    it('should handle missing or invalid callback gracefully', function() {
      aggregator.onSmartHarvestTrigger = null;
      expect(() => aggregator.checkSmartHarvestTrigger()).not.toThrow();

      aggregator.onSmartHarvestTrigger = 'not a function';
      aggregator.currentPayloadSize = aggregator.smartHarvestPayloadThreshold + 1;
      expect(() => aggregator.checkSmartHarvestTrigger()).not.toThrow();
    });
  });

  describe('makeRoom()', function() {
    beforeEach(function() {
      const dataSizeStub = sinon.stub(utils, 'dataSize').returns(1000);
      stubs.push(dataSizeStub);
    });

    it('should remove oldest events until both conditions met', function() {
      aggregator.totalEvents = Constants.MAX_EVENTS_PER_BATCH;
      aggregator.currentPayloadSize = Constants.MAX_PAYLOAD_SIZE;

      for (let i = 0; i < Constants.MAX_EVENTS_PER_BATCH; i++) {
        aggregator.buffer.push({actionName: `EVENT_${i}`});
      }

      aggregator.makeRoom(1000);

      expect(aggregator.totalEvents).toBeLessThan(Constants.MAX_EVENTS_PER_BATCH);
      expect(aggregator.currentPayloadSize).toBeLessThan(Constants.MAX_PAYLOAD_SIZE);
    });

    it('should return early if event size exceeds max payload', function() {
      const initialEvents = aggregator.totalEvents;
      aggregator.makeRoom(Constants.MAX_PAYLOAD_SIZE + 1000);
      expect(aggregator.totalEvents).toBe(initialEvents);
    });

    it('should handle empty buffer gracefully', function() {
      aggregator.totalEvents = Constants.MAX_EVENTS_PER_BATCH;
      aggregator.buffer = [];
      expect(() => aggregator.makeRoom(1000)).not.toThrow();
    });
  });

  describe('drain()', function() {
    it('should return all events, empty buffer and reset counters', function() {
      const dataSizeStub = sinon.stub(utils, 'dataSize').returns(100);
      stubs.push(dataSizeStub);

      aggregator.add({actionName: 'FIRST'});
      aggregator.add({actionName: 'SECOND'});
      aggregator.add({actionName: 'THIRD'});

      const events = aggregator.drain();

      expect(events.length).toBe(3);
      expect(events[0].actionName).toBe('FIRST');
      expect(events[2].actionName).toBe('THIRD');
      expect(aggregator.buffer).toEqual([]);
      expect(aggregator.totalEvents).toBe(0);
      expect(aggregator.currentPayloadSize).toBe(0);
    });

    it('should return empty array if buffer empty', function() {
      const events = aggregator.drain();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    });

    it('should handle errors gracefully', function() {
      const spliceStub = sinon.stub(aggregator.buffer, 'splice').throws(new Error('Drain error'));
      stubs.push(spliceStub);

      const events = aggregator.drain();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    });
  });

  describe('isEmpty()', function() {
    it('should return true for empty buffer and false otherwise', function() {
      expect(aggregator.isEmpty()).toBe(true);

      const dataSizeStub = sinon.stub(utils, 'dataSize').returns(100);
      stubs.push(dataSizeStub);

      aggregator.add({actionName: 'TEST'});
      expect(aggregator.isEmpty()).toBe(false);

      aggregator.drain();
      expect(aggregator.isEmpty()).toBe(true);
    });
  });

  describe('clear()', function() {
    it('should empty buffer and reset totalEvents', function() {
      const dataSizeStub = sinon.stub(utils, 'dataSize').returns(100);
      stubs.push(dataSizeStub);

      aggregator.add({actionName: 'TEST1'});
      aggregator.add({actionName: 'TEST2'});

      aggregator.clear();
      expect(aggregator.buffer).toEqual([]);
      expect(aggregator.totalEvents).toBe(0);
    });

    it('should not error on empty buffer', function() {
      expect(() => aggregator.clear()).not.toThrow();
    });
  });
});
