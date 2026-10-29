export type Currency = 'EUR';

const supportedCurrencies: readonly Currency[] = ['EUR'];

export class Money {
  private constructor(
    readonly amountMinor: number,
    readonly currency: Currency,
  ) {}

  static fromMinor(amountMinor: number, currency: string): Money {
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
      throw new RangeError('Amount must be a non-negative safe integer in minor units.');
    }

    if (!supportedCurrencies.includes(currency as Currency)) {
      throw new RangeError(`Unsupported currency: ${currency}`);
    }

    return new Money(amountMinor, currency as Currency);
  }

  equals(other: Money): boolean {
    return this.amountMinor === other.amountMinor && this.currency === other.currency;
  }

  compareTo(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    return this.amountMinor < other.amountMinor ? -1 : this.amountMinor > other.amountMinor ? 1 : 0;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    const sum = this.amountMinor + other.amountMinor;
    if (!Number.isSafeInteger(sum)) {
      throw new RangeError('Money addition exceeds the safe integer range.');
    }
    return new Money(sum, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const difference = this.amountMinor - other.amountMinor;
    if (difference < 0) {
      throw new RangeError('Money subtraction cannot produce a negative amount.');
    }
    return new Money(difference, this.currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new RangeError('Money values must use the same currency.');
    }
  }
}