import sinon from 'sinon';
import { OptimizedHttpClient } from '../src/optimizedHttpClient';
import OptimizedHttpClientDefault from '../src/optimizedHttpClient';
import Log from '../src/log';
import * as utils from '../src/utils';

describe('OptimizedHttpClient', function() {
  let client;
  let clock;
  let stubs = [];

  beforeAll(function() {
    Log.level = Log.Levels.SILENT;
  });

  afterAll(function() {
    Log.level = Log.Levels.ERROR;
  });

  beforeEach(function() {
    client = new OptimizedHttpClient();
    clock = sinon.useFakeTimers();
    stubs = [];

    global.fetch = sinon.stub().resolves({
      ok: true,
      status: 200,
      json: () => Promise.resolve({})
    });

    global.AbortController = class {
      signal = { aborted: false };
      abort() {
        this.signal.aborted = true;
      }
    };

    global.navigator = {
      sendBeacon: sinon.stub().returns(true)
    };
  });

  afterEach(function() {
    stubs.forEach(stub => stub.restore && stub.restore());
    stubs = [];
    clock.restore();
    delete global.fetch;
    delete global.AbortController;
    delete global.navigator;
  });

  describe('module exports', function() {
    it('should export OptimizedHttpClient as default', function() {
      expect(OptimizedHttpClientDefault).toBe(OptimizedHttpClient);
    });

    it('should create instance from default export', function() {
      const instance = new OptimizedHttpClientDefault();
      expect(instance).toBeInstanceOf(OptimizedHttpClient);
    });
  });

  describe('request validation', function() {
    it('should reject request without URL', function(done) {
      client.send({payload: {body: 'test'}}, function(result) {
        expect(result.retry).toBe(false);
        expect(result.error).toBeDefined();
        done();
      });
    });

    it('should reject request without payload', function(done) {
      client.send({url: 'http://test.com'}, function(result) {
        expect(result.retry).toBe(false);
        expect(result.error).toBeDefined();
        done();
      });
    });

    it('should accept valid request', function(done) {
      client.send({
        url: 'http://test.com',
        payload: {body: {ins: [{actionName: 'TEST'}]}}
      }, function(result) {
        expect(result.retry).toBe(false);
        expect(result.status).toBe(200);
        done();
      });
    });
  });

  describe('executeRequest', function() {
    it('should send POST request with correct headers and body', async function() {
      const request = {
        url: 'http://test.com',
        payload: {body: {ins: [{actionName: 'PLAY'}]}},
        options: {},
        callback: sinon.stub()
      };
      await client.executeRequest(request);

      expect(global.fetch.called).toBe(true);
      const fetchCall = global.fetch.firstCall.args[1];
      expect(fetchCall.method).toBe('POST');
      expect(fetchCall.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(fetchCall.body)).toEqual({ins: [{actionName: 'PLAY'}]});
      expect(fetchCall.keepalive).toBeUndefined();
      expect(fetchCall.signal).toBeDefined();
    });

    it('should use sendBeacon for final harvest', async function() {
      const request = {
        url: 'http://test.com',
        payload: {body: {ins: [{actionName: 'PLAY'}]}},
        options: {isFinalHarvest: true},
        callback: sinon.stub()
      };
      await client.executeRequest(request);
      expect(global.navigator.sendBeacon.called).toBe(true);
    });

    it('should fallback to fetch with keepalive when sendBeacon unavailable', async function() {
      delete global.navigator.sendBeacon;
      const request = {
        url: 'http://test.com',
        payload: {body: {ins: [{actionName: 'PLAY'}]}},
        options: {isFinalHarvest: true},
        callback: sinon.stub()
      };

      await client.executeRequest(request);
      expect(global.fetch.called).toBe(true);
      const fetchCall = global.fetch.firstCall.args[1];
      expect(fetchCall.keepalive).toBe(true);

      // Restore for other tests
      global.navigator.sendBeacon = sinon.stub().returns(true);
    });
  });

  describe('sendWithBeacon', function() {
    it('should return true on successful beacon send', async function() {
      global.navigator.sendBeacon.returns(true);
      const result = await client.sendWithBeacon('http://test.com', JSON.stringify({ins: []}));
      expect(result).toBe(true);
    });

    it('should return false when beacon fails', async function() {
      global.navigator.sendBeacon.returns(false);
      const result = await client.sendWithBeacon('http://test.com', JSON.stringify({ins: []}));
      expect(result).toBe(false);
    });

    it('should handle beacon errors gracefully', async function() {
      global.navigator.sendBeacon.throws(new Error('Beacon error'));
      const result = await client.sendWithBeacon('http://test.com', JSON.stringify({ins: []}));
      expect(result).toBe(false);
    });
  });

  describe('fetchWithTimeout', function() {
    it('should clear timeout on successful fetch', async function() {
      global.fetch.resolves({ok: true, status: 200});
      const clearTimeoutSpy = sinon.spy(global, 'clearTimeout');

      const result = await client.fetchWithTimeout('http://test.com', {}, 10000);
      expect(result.ok).toBe(true);
      expect(clearTimeoutSpy.called).toBe(true);
      clearTimeoutSpy.restore();
    });

    it('should clear timeout on fetch error', async function() {
      global.fetch.rejects(new Error('Network error'));
      const clearTimeoutSpy = sinon.spy(global, 'clearTimeout');

      try {
        await client.fetchWithTimeout('http://test.com', {}, 10000);
      } catch(e) {
        expect(e.message).toBe('Network error');
      }
      expect(clearTimeoutSpy.called).toBe(true);
      clearTimeoutSpy.restore();
    });

    it('should detect and handle AbortError as timeout', async function() {
      global.fetch.rejects({name: 'AbortError', message: 'Aborted'});

      try {
        await client.fetchWithTimeout('http://test.com', {}, 10000);
      } catch(error) {
        expect(error.message).toContain('timeout');
      }
    });

    it('should abort request when timeout is reached', async function() {
      let abortCalled = false;
      global.AbortController = class {
        signal = { aborted: false };
        abort() {
          abortCalled = true;
          this.signal.aborted = true;
        }
      };
      global.fetch.returns(new Promise(() => {}));

      client.fetchWithTimeout('http://test.com', {}, 100);
      clock.tick(101);
      await Promise.resolve();
      expect(abortCalled).toBe(true);
    });
  });

  describe('handleRequestComplete', function() {
    it('should not retry on successful request', function(done) {
      client.handleRequestComplete(
        {callback: (r) => {
          expect(r.retry).toBe(false);
          expect(r.status).toBe(200);
          done();
        }},
        {success: true, status: 200},
        Date.now()
      );
    });

    it('should retry on network error (status 0)', function(done) {
      client.handleRequestComplete(
        {callback: (r) => {
          expect(r.retry).toBe(true);
          done();
        }},
        {success: false, status: 0},
        Date.now()
      );
    });

    it('should retry on retryable status codes', function(done) {
      const shouldRetryStub = sinon.stub(utils, 'shouldRetry').returns(true);
      stubs.push(shouldRetryStub);

      let testCount = 0;
      const retryableStatuses = [500, 408, 429, 502];

      retryableStatuses.forEach(status => {
        client.handleRequestComplete(
          {callback: (r) => {
            expect(r.retry).toBe(true);
            if (++testCount === retryableStatuses.length) done();
          }},
          {success: false, status},
          Date.now()
        );
      });
    });

    it('should not retry on non-retryable status codes', function(done) {
      const shouldRetryStub = sinon.stub(utils, 'shouldRetry').returns(false);
      stubs.push(shouldRetryStub);

      let testCount = 0;
      const nonRetryableStatuses = [401, 403, 404];

      nonRetryableStatuses.forEach(status => {
        client.handleRequestComplete(
          {callback: (r) => {
            expect(r.retry).toBe(false);
            if (++testCount === nonRetryableStatuses.length) done();
          }},
          {success: false, status},
          Date.now()
        );
      });
    });
  });

  describe('send integration', function() {
    it('should complete successful request', function(done) {
      client.send({
        url: 'http://test.com',
        payload: {body: {ins: [{actionName: 'PLAY'}]}}
      }, (result) => {
        expect(result.retry).toBe(false);
        expect(result.status).toBe(200);
        done();
      });
    });

    it('should retry on fetch failure with retryable status', function(done) {
      global.fetch.resolves({ok: false, status: 500});
      const shouldRetryStub = sinon.stub(utils, 'shouldRetry').returns(true);
      stubs.push(shouldRetryStub);

      client.send({
        url: 'http://test.com',
        payload: {body: {ins: [{actionName: 'PLAY'}]}}
      }, (result) => {
        expect(result.retry).toBe(true);
        expect(result.status).toBe(500);
        done();
      });
    });

    it('should handle successful sendBeacon', function(done) {
      global.navigator.sendBeacon.returns(true);

      client.send({
        url: 'http://test.com',
        payload: {body: {ins: [{actionName: 'PLAY'}]}},
        options: {isFinalHarvest: true}
      }, (result) => {
        expect(result.retry).toBe(false);
        expect(result.status).toBe(204);
        done();
      });
    });

    it('should retry on sendBeacon failure', function(done) {
      global.navigator.sendBeacon.returns(false);

      client.send({
        url: 'http://test.com',
        payload: {body: {ins: [{actionName: 'PLAY'}]}},
        options: {isFinalHarvest: true}
      }, (result) => {
        expect(result.retry).toBe(true);
        expect(result.status).toBe(0);
        done();
      });
    });

    it('should retry on network error', function(done) {
      global.fetch.rejects(new Error('Network failure'));

      client.send({
        url: 'http://test.com',
        payload: {body: {ins: [{actionName: 'PLAY'}]}}
      }, (result) => {
        expect(result.retry).toBe(true);
        expect(result.error).toBeDefined();
        done();
      });
    });
  });
});
