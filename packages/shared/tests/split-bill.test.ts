import { describe, expect, it } from 'vitest';
import { allocateSplitBill } from '../src/split-bill.js';

describe('exact split bill allocation', () => {
  const participants = [{ userId: 'owner' }, { userId: 'alex' }, { userId: 'lea' }];
  it('distributes leftover cents in displayed participant order', () => {
    expect(
      allocateSplitBill(1001, 'EQUAL', participants).map((entry) => entry.amountMinor),
    ).toEqual([334, 334, 333]);
  });
  it('handles the safe integer boundary without floating-point rounding', () => {
    const shares = allocateSplitBill(Number.MAX_SAFE_INTEGER, 'EQUAL', participants);
    expect(shares.reduce((total, entry) => total + BigInt(entry.amountMinor), 0n)).toBe(
      BigInt(Number.MAX_SAFE_INTEGER),
    );
  });
  it('accepts exact custom amounts', () => {
    expect(
      allocateSplitBill(1000, 'CUSTOM', [
        { userId: 'owner', amountMinor: 400 },
        { userId: 'alex', amountMinor: 600 },
      ]),
    ).toEqual([
      { userId: 'owner', amountMinor: 400 },
      { userId: 'alex', amountMinor: 600 },
    ]);
  });
  it.each([0, -1, 0.1, Number.MAX_SAFE_INTEGER + 1])('rejects invalid totals %s', (total) => {
    expect(() => allocateSplitBill(total, 'EQUAL', participants)).toThrow();
  });
  it('rejects too-small totals, duplicate and excessive participants', () => {
    expect(() => allocateSplitBill(2, 'EQUAL', participants)).toThrow('at least one cent');
    expect(() =>
      allocateSplitBill(100, 'EQUAL', [{ userId: 'owner' }, { userId: 'owner' }]),
    ).toThrow('distinct');
    expect(() => allocateSplitBill(100, 'EQUAL', [{ userId: 'owner' }])).toThrow('2 to 20');
    expect(() =>
      allocateSplitBill(
        100,
        'EQUAL',
        Array.from({ length: 21 }, (_, index) => ({ userId: String(index) })),
      ),
    ).toThrow('2 to 20');
  });
  it('rejects mismatched, fractional and missing custom shares', () => {
    expect(() =>
      allocateSplitBill(100, 'CUSTOM', [
        { userId: 'owner', amountMinor: 40 },
        { userId: 'alex', amountMinor: 50 },
      ]),
    ).toThrow('add up exactly');
    expect(() =>
      allocateSplitBill(100, 'CUSTOM', [
        { userId: 'owner', amountMinor: 49.5 },
        { userId: 'alex', amountMinor: 50.5 },
      ]),
    ).toThrow('safe integer');
    expect(() => allocateSplitBill(100, 'CUSTOM', participants)).toThrow('safe integer');
    expect(() =>
      allocateSplitBill(100, 'EQUAL', [
        { userId: 'owner', amountMinor: 50 },
        { userId: 'alex', amountMinor: 50 },
      ]),
    ).toThrow('do not accept');
  });
});
