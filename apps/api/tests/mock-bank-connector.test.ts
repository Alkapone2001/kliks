import { describe, expect, it } from 'vitest';
import { Money } from '@kliks/shared';
import { MockBankConnector } from '../src/modules/banking/mock-bank-connector.js';

describe('MockBankConnector', () => {
  it('creates a deterministic simulated account connection', async () => {
    const connector = new MockBankConnector();
    const request = { connectionId: 'connection-internal-1' };

    await expect(connector.connectAccount(request)).resolves.toEqual({
      providerAccountReference: 'mock_account_connection-internal-1',
      displayName: 'Mock Bank Demo Account',
      status: 'PENDING_AUTHORIZATION',
      simulation: true,
    });
    await expect(connector.connectAccount(request)).resolves.toEqual(
      await connector.connectAccount(request),
    );
  });

  it('simulates authorization approval, rejection, and disconnection', async () => {
    const connector = new MockBankConnector();

    await expect(connector.authorizeAccount('mock_account_1', 'APPROVE')).resolves.toMatchObject({
      status: 'CONNECTED',
      simulation: true,
    });
    await expect(connector.authorizeAccount('mock_account_2', 'REJECT')).resolves.toMatchObject({
      status: 'REJECTED',
      simulation: true,
    });
    await expect(connector.disconnectAccount('mock_account_1')).resolves.toMatchObject({
      status: 'DISCONNECTED',
      simulation: true,
    });
  });

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
