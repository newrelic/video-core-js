import sinon from 'sinon';
import Core from '../src/core';
import Log from '../src/log';
import * as recordEventModule from '../src/recordEvent';
import * as videoConfigModule from '../src/videoConfiguration';

describe('Core', function() {
  let stubs = [];

  beforeAll(function() {
    Log.level = Log.Levels.SILENT;
  });

  afterAll(function() {
    Log.level = Log.Levels.ERROR;
  });

  beforeEach(function() {
    // Clear trackers before each test
    while (Core.getTrackers().length > 0) {
      const tracker = Core.getTrackers()[0];
      if (!tracker.off) {
        tracker.off = sinon.stub();
      }
      Core.removeTracker(tracker);
    }
    stubs = [];
  });

  afterEach(function() {
    stubs.forEach(stub => stub.restore && stub.restore());
    stubs = [];
  });

  describe('addTracker()', function() {
    it('should add valid tracker', function() {
      const tracker = {
        on: sinon.stub(),
        emit: sinon.stub(),
        dispose: sinon.stub(),
        trackerInit: sinon.stub()
      };

      Core.addTracker(tracker);

      expect(Core.getTrackers()).toContain(tracker);
      expect(tracker.on.calledWith('*')).toBe(true);
      expect(tracker.trackerInit.called).toBe(true);
    });

    it('should reject tracker without on method', function() {
      const tracker = {
        emit: sinon.stub(),
        dispose: sinon.stub()
      };

      Core.addTracker(tracker);

      expect(Core.getTrackers()).not.toContain(tracker);
    });

    it('should set video config when options.info provided', function() {
      const setConfigStub = sinon.stub(videoConfigModule, 'setVideoConfig');
      stubs.push(setConfigStub);

      const tracker = {
        on: sinon.stub(),
        emit: sinon.stub(),
        dispose: sinon.stub()
      };

      const options = {
        info: {
          licenseKey: 'test-key',
          appName: 'TestApp'
        }
      };

      Core.addTracker(tracker, options);

      expect(setConfigStub.calledWith(options.info)).toBe(true);
    });
  });

  describe('removeTracker()', function() {
    it('should remove tracker and call dispose', function() {
      const tracker = {
        on: sinon.stub(),
        off: sinon.stub(),
        emit: sinon.stub(),
        dispose: sinon.stub()
      };

      Core.addTracker(tracker);
      Core.removeTracker(tracker);

      expect(Core.getTrackers()).not.toContain(tracker);
      expect(tracker.off.calledWith('*')).toBe(true);
      expect(tracker.dispose.called).toBe(true);
    });

    it('should handle removing non-existent tracker', function() {
      const tracker = {
        off: sinon.stub(),
        dispose: sinon.stub()
      };

      expect(() => Core.removeTracker(tracker)).not.toThrow();
    });
  });

  describe('send Events', function() {
    it('should call recordEvent with enriched data', function() {
      const recordEventStub = sinon.stub(recordEventModule, 'recordEvent');
      stubs.push(recordEventStub);

      Core.send('VideoAction', 'PLAY', {duration: 120});

      expect(recordEventStub.calledOnce).toBe(true);
      expect(recordEventStub.firstCall.args[0]).toBe('VideoAction');
      expect(recordEventStub.firstCall.args[1]).toMatchObject({
        actionName: 'PLAY',
        duration: 120
      });
    });
  });

  describe('sendError Events', function() {
    it('should call recordEvent with VideoErrorAction and ERROR actionName', function() {
      const recordEventStub = sinon.stub(recordEventModule, 'recordEvent');
      stubs.push(recordEventStub);

      Core.sendError({errorCode: 500, message: 'Server error'});

      expect(recordEventStub.calledOnce).toBe(true);
      expect(recordEventStub.firstCall.args[0]).toBe('VideoErrorAction');
      expect(recordEventStub.firstCall.args[1].actionName).toBe('ERROR');
      expect(recordEventStub.firstCall.args[1].errorCode).toBe(500);
    });
  });

  describe('eventHandler with cleanData', function() {
    it('should remove null/undefined and preserve falsy values', function() {
      const recordEventStub = sinon.stub(recordEventModule, 'recordEvent');
      stubs.push(recordEventStub);

      const tracker = {on: sinon.stub(), emit: sinon.stub(), dispose: sinon.stub()};
      Core.addTracker(tracker);

      const eventHandler = tracker.on.firstCall.args[1];
      eventHandler({
        type: 'PLAY',
        eventType: 'VideoAction',
        data: {
          valid: 'value',
          nullValue: null,
          undefinedValue: undefined,
          boolValue: false,
          zeroValue: 0,
          emptyString: ''
        }
      });

      const sentData = recordEventStub.firstCall.args[1];
      expect(sentData.nullValue).toBeUndefined();
      expect(sentData.undefinedValue).toBeUndefined();
      expect(sentData.valid).toBe('value');
      expect(sentData.boolValue).toBe(false);
      expect(sentData.zeroValue).toBe(0);
      expect(sentData.emptyString).toBe('');
    });

    it('should handle errors gracefully', function() {
      const recordEventStub = sinon.stub(recordEventModule, 'recordEvent').throws(new Error('Test error'));
      stubs.push(recordEventStub);

      const tracker = {on: sinon.stub(), emit: sinon.stub(), dispose: sinon.stub()};
      Core.addTracker(tracker);

      const eventHandler = tracker.on.firstCall.args[1];

      expect(() => eventHandler({
        type: 'PLAY',
        eventType: 'VideoAction',
        data: {}
      })).not.toThrow();
    });

    it('should log at DEBUG level with data', function() {
      const recordEventStub = sinon.stub(recordEventModule, 'recordEvent');
      stubs.push(recordEventStub);

      Log.level = Log.Levels.DEBUG;
      const logNoticeSpy = sinon.spy(Log, 'notice');
      stubs.push(logNoticeSpy);

      const tracker = {on: sinon.stub(), emit: sinon.stub(), dispose: sinon.stub()};
      Core.addTracker(tracker);

      const eventHandler = tracker.on.firstCall.args[1];
      eventHandler({
        type: 'PLAY',
        eventType: 'VideoAction',
        data: {test: 'data'}
      });

      expect(logNoticeSpy.called).toBe(true);
      Log.level = Log.Levels.SILENT;
    });
  });

  describe('forceHarvest()', function() {
    it('should handle forceHarvest call', async function() {
      const result = await Core.forceHarvest();
      expect(typeof result).toBe('object');
    });
  });
});

