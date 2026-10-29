import { describe, expect, it } from 'vitest';
import { Money } from '../src/money.js';

describe('Money', () => {
  it('accepts safe non-negative integer minor units and an explicit currency', () => {
    expect(Money.fromMinor(1099, 'EUR')).toMatchObject({ amountMinor: 1099, currency: 'EUR' });
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN])(
    'rejects invalid minor-unit amount %s',
    (amount) => {
      expect(() => Money.fromMinor(amount, 'EUR')).toThrow(RangeError);
    },
  );

  it('rejects unsupported currencies', () => {
    expect(() => Money.fromMinor(100, 'USD')).toThrow('Unsupported currency');
  });

  it('compares and adds only values with the same currency', () => {
    const oneEuro = Money.fromMinor(100, 'EUR');
    const twoEuro = Money.fromMinor(200, 'EUR');

    expect(oneEuro.compareTo(twoEuro)).toBe(-1);
    expect(oneEuro.add(twoEuro).amountMinor).toBe(300);
    expect(oneEuro.equals(Money.fromMinor(100, 'EUR'))).toBe(true);
  });

  it('rejects mixed-currency arithmetic and negative subtraction results', () => {
    const euro = Money.fromMinor(100, 'EUR');

    expect(() => euro.compareTo({ amountMinor: 100, currency: 'USD' } as unknown as Money)).toThrow(
      'same currency',
    );
    expect(() => euro.subtract(Money.fromMinor(101, 'EUR'))).toThrow('negative amount');
  });
});
