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
    delete global.window;
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
  });
});
