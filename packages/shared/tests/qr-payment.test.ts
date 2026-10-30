import { describe, expect, it } from 'vitest';
import { parseQrPaymentPayload } from '../src/qr-payment.js';

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
