import { parseTrustProxy } from './trust-proxy.js';

describe('parseTrustProxy', () => {
  it('returns a hop count as a number', () => {
    expect(parseTrustProxy('1')).toBe(1);
  });

  it('returns a list of trimmed ranges and addresses', () => {
    expect(parseTrustProxy(' loopback , 10.0.0.0/8,::1 ')).toEqual([
      'loopback',
      '10.0.0.0/8',
      '::1',
    ]);
  });

  it.each(['true', '*', '', 'loopback,', '10.0.0.0/33', 'fd00::/129', 'host'])(
    'returns null for %j',
    (value) => {
      expect(parseTrustProxy(value)).toBeNull();
    },
  );
});
