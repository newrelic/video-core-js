import sinon from 'sinon';
import { applyObfuscationRules } from '../src/obfuscate';
import Log from '../src/log';

describe('applyObfuscationRules', function () {
  beforeAll(function () {
    Log.level = Log.Levels.SILENT;
  });

  afterAll(function () {
    Log.level = Log.Levels.ERROR;
  });

  it('returns input unchanged when rules is undefined', function () {
    const input = '{"contentSrc":"https://example.com/video.mp4"}';
    expect(applyObfuscationRules(input, undefined)).toBe(input);
  });

  it('returns input unchanged when rules is null', function () {
    const input = '{"contentSrc":"https://example.com/video.mp4"}';
    expect(applyObfuscationRules(input, null)).toBe(input);
  });

  it('returns input unchanged when rules is an empty array', function () {
    const input = '{"contentSrc":"https://example.com/video.mp4"}';
    expect(applyObfuscationRules(input, [])).toBe(input);
  });

  it('applies a single string pattern rule', function () {
    const input = '{"token":"secret-abc123","event":"CONTENT_START"}';
    const rules = [{ regex: 'secret-[a-z0-9]+', replacement: '***' }];
    expect(applyObfuscationRules(input, rules)).toBe('{"token":"***","event":"CONTENT_START"}');
  });

  it('applies a RegExp object rule', function () {
    const input = '{"contentSrc":"https://cdn.example.com/user/12345/video.mp4"}';
    const rules = [{ regex: /\/user\/\d+/, replacement: '/user/[REDACTED]' }];
    expect(applyObfuscationRules(input, rules)).toBe('{"contentSrc":"https://cdn.example.com/user/[REDACTED]/video.mp4"}');
  });

  it('applies multiple rules in order', function () {
    const input = '{"token":"secret-abc","accountId":"acct-999","event":"START"}';
    const rules = [
      { regex: 'secret-[a-z]+', replacement: '[TOKEN]' },
      { regex: 'acct-\\d+', replacement: '[ACCOUNT]' },
    ];
    const result = applyObfuscationRules(input, rules);
    expect(result).toBe('{"token":"[TOKEN]","accountId":"[ACCOUNT]","event":"START"}');
  });

  it('replaces all occurrences in the string', function () {
    const input = '{"a":"secret-x","b":"secret-y"}';
    const rules = [{ regex: 'secret-[a-z]', replacement: 'REDACTED' }];
    expect(applyObfuscationRules(input, rules)).toBe('{"a":"REDACTED","b":"REDACTED"}');
  });

  it('deletes matched content when replacement is an empty string', function () {
    const input = '{"contentSrc":"https://example.com?token=abc123"}';
    const rules = [{ regex: '\\?token=[^"]+', replacement: '' }];
    expect(applyObfuscationRules(input, rules)).toBe('{"contentSrc":"https://example.com"}');
  });

  it('logs a warning and skips invalid regex, continuing with remaining rules', function () {
    const warnSpy = sinon.spy(Log, 'warn');
    const input = '{"token":"secret-abc","accountId":"acct-999"}';
    const rules = [
      { regex: '[invalid(regex', replacement: 'SKIP' },
      { regex: 'acct-\\d+', replacement: '[ACCOUNT]' },
    ];

    const result = applyObfuscationRules(input, rules);

    expect(warnSpy.calledOnce).toBe(true);
    expect(result).toBe('{"token":"secret-abc","accountId":"[ACCOUNT]"}');

    warnSpy.restore();
  });

  it('supports RegExp objects that already have the global flag', function () {
    const input = '{"a":"tok-1","b":"tok-2"}';
    const rules = [{ regex: /tok-\d/g, replacement: 'X' }];
    expect(applyObfuscationRules(input, rules)).toBe('{"a":"X","b":"X"}');
  });

  it('supports RegExp objects without global flag (adds it automatically)', function () {
    const input = '{"a":"tok-1","b":"tok-2"}';
    // No global flag — should still replace all occurrences
    const rules = [{ regex: /tok-\d/, replacement: 'X' }];
    expect(applyObfuscationRules(input, rules)).toBe('{"a":"X","b":"X"}');
  });
});
