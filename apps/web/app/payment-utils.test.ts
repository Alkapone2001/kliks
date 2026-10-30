import { describe, expect, it } from 'vitest';
import { formatEuro, parseEuroMinorUnits, readIdentities } from './payment-utils';

describe('browser payment amounts', () => {
  it('converts exact decimal amounts to integer minor units', () => {
    expect(parseEuroMinorUnits('12.34')).toBe(1234);
    expect(parseEuroMinorUnits('0,01')).toBe(1);
    expect(parseEuroMinorUnits(' 001.2 ')).toBe(120);
    expect(parseEuroMinorUnits('10')).toBe(1000);
  });
  it.each(['', '0', '-1', '1.001', '1e3', '.1', 'Infinity', '90071992547409.92'])(
    'rejects invalid or unsafe amount %s',
    (value) => {
      expect(parseEuroMinorUnits(value)).toBeUndefined();
    },
  );
  it('formats without floating-point arithmetic', () => {
    expect(formatEuro(1)).toBe('EUR 0.01');
    expect(formatEuro(1234)).toBe('EUR 12.34');
  });
});

describe('local development identities', () => {
  it('ignores malformed storage', () => {
    expect(readIdentities('{')).toEqual([]);
    expect(readIdentities('{}')).toEqual([]);
    expect(readIdentities('[null, {"id":"invalid","username":"test"}]')).toEqual([]);
  });
  it('retains only the identity ID and username', () => {
    const id = '12345678-1234-1234-1234-123456789012';
    expect(
      readIdentities(JSON.stringify([{ id, username: 'test', phoneNumber: 'private' }])),
    ).toEqual([{ id, username: 'test' }]);
  });
});
