import sinon from 'sinon';
import { setVideoConfig } from '../src/videoConfiguration';
import Constants from '../src/constants';
import Log from '../src/log';

describe('videoConfiguration', function() {
  let stubs = [];

  beforeAll(function() {
    Log.level = Log.Levels.SILENT;
  });

  afterAll(function() {
    Log.level = Log.Levels.ERROR;
  });

  beforeEach(function() {
    global.window = {};
    stubs = [];
  });

  afterEach(function() {
    stubs.forEach(stub => stub.restore && stub.restore());
    stubs = [];
  });

  describe('setVideoConfig()', function() {
    describe('validation', function() {
      it('should reject invalid input types', function() {
        const invalidInputs = [null, 'invalid', 123, []];

        invalidInputs.forEach(input => {
          delete global.window.NRVIDEO;
          const result = setVideoConfig(input);
          expect(result).toBe(false);
          expect(global.window.NRVIDEO).toBeUndefined();
        });
      });
    });

    describe('applicationID path', function() {
      it('should accept valid applicationID with beacon', function() {
        const config = {
          licenseKey: 'test-key',
          applicationID: 'app-123',
          beacon: 'bam.nr-data.net'
        };

        const result = setVideoConfig(config);

        expect(result).toBe(true);
        expect(global.window.NRVIDEO).toBeDefined();
        expect(global.window.NRVIDEO.info.licenseKey).toBe('test-key');
        expect(global.window.NRVIDEO.info.applicationID).toBe('app-123');
        expect(global.window.NRVIDEO.info.beacon).toBe('bam.nr-data.net');
      });

      it('should reject applicationID without beacon', function() {
        const config = {
          licenseKey: 'test-key',
          applicationID: 'app-123'
        };

        const result = setVideoConfig(config);
        expect(result).toBe(false);
      });

      it('should reject invalid beacon', function() {
        const config = {
          licenseKey: 'test-key',
          applicationID: 'app-123',
          beacon: 'invalid-beacon.com'
        };

        const result = setVideoConfig(config);
        expect(result).toBe(false);
      });

      it('should accept all valid beacons', function() {
        const validBeacons = [
          'bam.nr-data.net',
          'bam-cell.nr-data.net',
          'bam.eu01.nr-data.net',
          'staging-bam-cell.nr-data.net',
          'gov-bam.nr-data.net'
        ];

        validBeacons.forEach(beacon => {
          delete global.window.NRVIDEO;
          const config = {
            licenseKey: 'test-key',
            applicationID: 'app-123',
            beacon: beacon
          };

          setVideoConfig(config);
          expect(global.window.NRVIDEO.info.beacon).toBe(beacon);
        });
      });
    });

    describe('appName/region path', function() {
      it('should accept valid appName and region', function() {
        const config = {
          licenseKey: 'test-key',
          appName: 'MyApp',
          region: 'US'
        };

        setVideoConfig(config);

        expect(global.window.NRVIDEO).toBeDefined();
        expect(global.window.NRVIDEO.info.appName).toBe('MyApp');
        expect(global.window.NRVIDEO.info.region).toBe('US');
      });

      it('should require both appName and region', function() {
        // Test missing region
        let result = setVideoConfig({
          licenseKey: 'test-key',
          appName: 'MyApp'
        });
        expect(result).toBe(false);

        // Test missing appName
        result = setVideoConfig({
          licenseKey: 'test-key',
          region: 'US'
        });
        expect(result).toBe(false);
      });

      it('should reject invalid region', function() {
        const config = {
          licenseKey: 'test-key',
          appName: 'MyApp',
          region: 'INVALID'
        };

        const result = setVideoConfig(config);
        expect(result).toBe(false);
      });

      it('should accept all valid regions', function() {
        const validRegions = ['US', 'EU', 'Staging', 'GOV'];

        validRegions.forEach(region => {
          delete global.window.NRVIDEO;
          const config = {
            licenseKey: 'test-key',
            appName: 'MyApp',
            region: region
          };

          setVideoConfig(config);
          expect(global.window.NRVIDEO.info.region).toBe(region);
        });
      });
    });

    describe('config parameter validation', function() {
      it('should accept valid config with qoeAggregate as true', function() {
        const info = {
          licenseKey: 'test-key',
          appName: 'MyApp',
          region: 'US'
        };
        const config = {
          qoeAggregate: true
        };

        const result = setVideoConfig(info, config);

        expect(result).toBe(true);
        expect(global.window.NRVIDEO.config.qoeAggregate).toBe(true);
      });

      it('should accept valid config with qoeAggregate as false', function() {
        const info = {
          licenseKey: 'test-key',
          appName: 'MyApp',
          region: 'US'
        };
        const config = {
          qoeAggregate: false
        };

        const result = setVideoConfig(info, config);

        expect(result).toBe(true);
        expect(global.window.NRVIDEO.config.qoeAggregate).toBe(false);
      });

      it('should default qoeAggregate to true when config is undefined', function() {
        const info = {
          licenseKey: 'test-key',
          appName: 'MyApp',
          region: 'US'
        };

        const result = setVideoConfig(info);

        expect(result).toBe(true);
        expect(global.window.NRVIDEO.config.qoeAggregate).toBe(true);
      });

      it('should default qoeAggregate to true when config is null', function() {
        const info = {
          licenseKey: 'test-key',
          appName: 'MyApp',
          region: 'US'
        };

        const result = setVideoConfig(info, null);

        expect(result).toBe(true);
        expect(global.window.NRVIDEO.config.qoeAggregate).toBe(true);
      });

      it('should default qoeAggregate to true when qoeAggregate is undefined in config', function() {
        const info = {
          licenseKey: 'test-key',
          appName: 'MyApp',
          region: 'US'
        };
        const config = {};

        const result = setVideoConfig(info, config);

        expect(result).toBe(true);
        expect(global.window.NRVIDEO.config.qoeAggregate).toBe(true);
      });

      it('should reject config when it is not an object', function() {
        const info = {
          licenseKey: 'test-key',
          appName: 'MyApp',
          region: 'US'
        };

        const invalidConfigs = ['string', 123, true];

        invalidConfigs.forEach(invalidConfig => {
          delete global.window.NRVIDEO;
          const result = setVideoConfig(info, invalidConfig);
          expect(result).toBe(false);
          expect(global.window.NRVIDEO).toBeUndefined();
        });
      });

      it('should reject config when it is an array', function() {
        const info = {
          licenseKey: 'test-key',
          appName: 'MyApp',
          region: 'US'
        };

        const result = setVideoConfig(info, []);

        expect(result).toBe(false);
        expect(global.window.NRVIDEO).toBeUndefined();
      });

      it('should reject config when qoeAggregate is not a boolean', function() {
        const info = {
          licenseKey: 'test-key',
          appName: 'MyApp',
          region: 'US'
        };

        const invalidQoeValues = ['true', 1, 0, null, {}, []];

        invalidQoeValues.forEach(invalidQoeValue => {
          delete global.window.NRVIDEO;
          const config = { qoeAggregate: invalidQoeValue };
          const result = setVideoConfig(info, config);
          expect(result).toBe(false);
          expect(global.window.NRVIDEO).toBeUndefined();
        });
      });

      it('should work with applicationID path and valid config', function() {
        const info = {
          licenseKey: 'test-key',
          applicationID: 'app-123',
          beacon: 'bam.nr-data.net'
        };
        const config = {
          qoeAggregate: false
        };

        const result = setVideoConfig(info, config);

        expect(result).toBe(true);
        expect(global.window.NRVIDEO.config.qoeAggregate).toBe(false);
        expect(global.window.NRVIDEO.info.applicationID).toBe('app-123');
      });
    });

    describe('browser agent config fallback', function() {
      beforeEach(function() {
        // The outer-level `global.window = {}` reset doesn't reliably clear
        // stale window.NRVIDEO left by earlier tests in this file (same
        // jsdom quirk other describe blocks work around with explicit
        // `delete global.window.NRVIDEO` calls) — explicit here too since
        // hasExistingConfig() now checks window.NRVIDEO.info.licenseKey.
        delete global.window.NREUM;
        delete global.window.newrelic;
        delete global.window.NRVIDEO;
      });

      afterEach(function() {
        delete global.window.NREUM;
        delete global.window.newrelic;
        delete global.window.NRVIDEO;
      });

      it('should not throw when info is omitted and no browser agent is present', function() {
        expect(() => setVideoConfig()).not.toThrow();
        expect(setVideoConfig()).toBe(false);
      });

      it('should not throw when info is omitted and a browser agent IS present', function() {
        global.window.NREUM = {
          info: {
            licenseKey: 'browser-key',
            applicationID: 'browser-app-456',
            beacon: 'bam.nr-data.net'
          }
        };

        expect(() => setVideoConfig()).not.toThrow();
        expect(setVideoConfig()).toBe(true);
      });

      it('should use NREUM.info when userInfo is omitted entirely', function() {
        global.window.NREUM = {
          info: {
            licenseKey: 'browser-key',
            applicationID: 'browser-app-456',
            beacon: 'bam.nr-data.net'
          }
        };

        const result = setVideoConfig();

        expect(result).toBe(true);
        expect(global.window.NRVIDEO.info.licenseKey).toBe('browser-key');
        expect(global.window.NRVIDEO.info.applicationID).toBe('browser-app-456');
        expect(global.window.NRVIDEO.info.beacon).toBe('bam.nr-data.net');
      });

      it('should use NREUM.info when userInfo is an empty object', function() {
        global.window.NREUM = {
          info: {
            licenseKey: 'browser-key',
            applicationID: 'browser-app-456',
            beacon: 'bam.nr-data.net'
          }
        };

        const result = setVideoConfig({});

        expect(result).toBe(true);
        expect(global.window.NRVIDEO.info.licenseKey).toBe('browser-key');
      });

      it('should fall back to window.newrelic.info when NREUM is absent', function() {
        global.window.newrelic = {
          info: {
            licenseKey: 'browser-key-2',
            applicationID: 'browser-app-789',
            beacon: 'bam-cell.nr-data.net'
          }
        };

        const result = setVideoConfig();

        expect(result).toBe(true);
        expect(global.window.NRVIDEO.info.licenseKey).toBe('browser-key-2');
      });

      it('should fall back to NREUM.initializedAgents[id].info when NREUM.info has no licenseKey (npm-style BrowserAgent construction)', function() {
        // Mirrors the real npm usage pattern: new BrowserAgent({ info }) sets
        // info on the agent *instance* only, never back onto window.NREUM.info.
        global.window.NREUM = {
          info: {
            beacon: 'bam.nr-data.net',
            errorBeacon: 'bam.nr-data.net'
          },
          initializedAgents: {
            abc123: {
              info: {
                licenseKey: 'npm-browser-key',
                applicationID: 'npm-app-999',
                beacon: 'bam-cell.nr-data.net'
              }
            }
          }
        };

        const result = setVideoConfig();

        expect(result).toBe(true);
        expect(global.window.NRVIDEO.info.licenseKey).toBe('npm-browser-key');
        expect(global.window.NRVIDEO.info.applicationID).toBe('npm-app-999');
      });

      it('should let explicit userInfo fields override the browser agent config', function() {
        global.window.NREUM = {
          info: {
            licenseKey: 'browser-key',
            applicationID: 'browser-app-456',
            beacon: 'bam.nr-data.net'
          }
        };

        const result = setVideoConfig({ applicationID: 'override-app' });

        expect(result).toBe(true);
        expect(global.window.NRVIDEO.info.licenseKey).toBe('browser-key');
        expect(global.window.NRVIDEO.info.applicationID).toBe('override-app');
      });

      it('should ignore a browser agent with no licenseKey yet (not initialized)', function() {
        global.window.NREUM = { info: {} };

        const result = setVideoConfig();

        expect(result).toBe(false);
        expect(global.window.NRVIDEO).toBeUndefined();
      });

      it('should still reject invalid-type userInfo even when a browser agent is present', function() {
        global.window.NREUM = {
          info: {
            licenseKey: 'browser-key',
            applicationID: 'browser-app-456',
            beacon: 'bam.nr-data.net'
          }
        };

        const result = setVideoConfig('invalid');

        expect(result).toBe(false);
        expect(global.window.NRVIDEO).toBeUndefined();
      });

      it('should require explicit config when no browser agent is present and userInfo is omitted', function() {
        const result = setVideoConfig();

        expect(result).toBe(false);
        expect(global.window.NRVIDEO).toBeUndefined();
      });

      it('should NOT let a later no-info call overwrite already-set explicit config, even if a browser agent is present', function() {
        // Customer explicitly configures their own key first.
        setVideoConfig({
          licenseKey: 'MY-OWN-KEY',
          appName: 'MyApp',
          region: 'US'
        });
        expect(global.window.NRVIDEO.info.licenseKey).toBe('MY-OWN-KEY');

        // A browser agent happens to also be present on the page.
        global.window.NREUM = {
          info: {
            licenseKey: 'browser-key',
            applicationID: 'browser-app-456',
            beacon: 'bam.nr-data.net'
          }
        };

        // A later call (e.g. via a second Core.addTracker) with no new info
        // must be a no-op, not silently re-derive from the browser agent.
        const result = setVideoConfig();

        expect(result).toBe(true);
        expect(global.window.NRVIDEO.info.licenseKey).toBe('MY-OWN-KEY');
      });

      it('should treat an empty object the same as omitted for the already-configured no-op', function() {
        setVideoConfig({
          licenseKey: 'MY-OWN-KEY',
          appName: 'MyApp',
          region: 'US'
        });

        global.window.NREUM = {
          info: {
            licenseKey: 'browser-key',
            applicationID: 'browser-app-456',
            beacon: 'bam.nr-data.net'
          }
        };

        const result = setVideoConfig({});

        expect(result).toBe(true);
        expect(global.window.NRVIDEO.info.licenseKey).toBe('MY-OWN-KEY');
      });

      it('should still let an explicit new licenseKey override existing config on a later call', function() {
        setVideoConfig({
          licenseKey: 'MY-OWN-KEY',
          appName: 'MyApp',
          region: 'US'
        });

        const result = setVideoConfig({
          licenseKey: 'MY-NEW-KEY',
          appName: 'MyApp',
          region: 'US'
        });

        expect(result).toBe(true);
        expect(global.window.NRVIDEO.info.licenseKey).toBe('MY-NEW-KEY');
      });

      it('should still reject null even when existing config is already present', function() {
        setVideoConfig({
          licenseKey: 'MY-OWN-KEY',
          appName: 'MyApp',
          region: 'US'
        });

        const result = setVideoConfig(null);

        expect(result).toBe(false);
      });
    });
  });
});
