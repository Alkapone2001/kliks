import { describe, expect, it } from 'vitest';
import { Money } from '@kliks/shared';
import { MockBankConnector } from '../src/modules/banking/mock-bank-connector';

describe('MockBankConnector', () => {
  it('returns a deterministic simulated pending payment', async () => {
    const connector = new MockBankConnector();
    const request = {
      paymentId: 'payment-internal-1',
      destinationReference: 'opaque-destination-1',
      amount: Money.fromMinor(2500, 'EUR'),
    };

    await expect(connector.initiatePayment(request)).resolves.toEqual({
      providerReference: 'mock_payment-internal-1',
      status: 'PENDING',
      simulation: true,
    });
    await expect(connector.initiatePayment(request)).resolves.toEqual(
      await connector.initiatePayment(request),
    );
  });

  it('reports mock references as simulated and unknown references as not found', async () => {
    const connector = new MockBankConnector();

    await expect(connector.getPaymentStatus('mock_payment-internal-1')).resolves.toEqual({
      providerReference: 'mock_payment-internal-1',
      status: 'PENDING',
      simulation: true,
    });
    await expect(connector.getPaymentStatus('unknown-reference')).resolves.toMatchObject({
      status: 'NOT_FOUND',
      simulation: true,
    });
  });
});
