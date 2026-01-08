import nrvideo from '../src/index';

describe('nrvideo entry point', () => {
  it('should export an object containing all components', () => {
    expect(nrvideo).toBeDefined();
    expect(typeof nrvideo).toBe('object');
    
    // Verifying a few properties to ensure the object was constructed correctly
    expect(nrvideo.Core).toBeDefined();
    expect(nrvideo.version).toBeDefined();
    expect(typeof nrvideo.recordEvent).toBe('function');
  });
});
