export const QR_PAYMENT_PAYLOAD_PATTERN =
  /^kliks:pay:v1:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;

export function parseQrPaymentPayload(value: unknown): string | undefined {
  return typeof value === 'string' ? QR_PAYMENT_PAYLOAD_PATTERN.exec(value)?.[1] : undefined;
}
