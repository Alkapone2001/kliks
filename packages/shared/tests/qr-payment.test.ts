import { describe, expect, it } from 'vitest';
import { parseMerchantQrPayload, parseQrPaymentPayload } from '../src/qr-payment.js';

describe('opaque QR payment payload', () => {
  const id = '12345678-1234-4234-9234-123456789012';
  it('resolves only the opaque versioned session reference', () => {
    expect(parseQrPaymentPayload(`kliks:pay:v1:${id}`)).toBe(id);
  });
  it.each([
    null,
    {},
    '',
    'https://example.com',
    'javascript:alert(1)',
    'kliks:pay:v2:123',
    'kliks:pay:v1:invalid',
    `kliks:pay:v1:${id}?amount=10`,
    `kliks:pay:v1:${id}/extra`,
    ` kliks:pay:v1:${id}`,
    `kliks:pay:v1:${id}\n`,
  ])('rejects unsupported or modified payload %s', (value) => {
    expect(parseQrPaymentPayload(value)).toBeUndefined();
  });
});

describe('static merchant QR reference', () => {
  const id = '12345678-1234-4234-9234-123456789012';
  it('accepts only an opaque merchant UUID', () => {
    expect(parseMerchantQrPayload(`kliks:merchant:v1:${id}`)).toBe(id);
    expect(parseQrPaymentPayload(`kliks:merchant:v1:${id}`)).toBeUndefined();
  });
  it.each([
    'https://example.com',
    `kliks:merchant:v1:${id}?amount=100`,
    'kliks:merchant:v1:bad',
    null,
  ])('rejects altered merchant payload %s', (value) => {
    expect(parseMerchantQrPayload(value)).toBeUndefined();
  });
});
