import { randomInt, randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseService } from '../src/database/database.service.js';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { MockBankConnector } from '../src/modules/banking/mock-bank-connector.js';
import { PaymentState } from '../src/modules/payments/domain/payment.js';
import { PaymentsService } from '../src/modules/payments/payments.service.js';

const database = new DatabaseService();
const paymentsService = new PaymentsService(
  database,
  new MockBankConnector(),
  new AuditService(database),
);
const createdUserIds: string[] = [];
const createdAccountIds: string[] = [];
const createdPaymentIds: string[] = [];

async function createParticipant(listed = true) {
  const suffix = randomInt(100000, 1000000).toString();
  const user = await database.client.user.create({
    data: {
      phoneNumber: `+38344${suffix}`,
      username: `payment_${suffix}`,
      phoneVerifiedAt: new Date(),
      directoryListingEnabled: listed,
    },
    select: { id: true },
  });
  createdUserIds.push(user.id);

  const account = await database.client.linkedBankAccount.create({
    data: {
      userId: user.id,
      connectorId: 'mock-bank',
      providerAccountReference: `mock_payment_account_${randomUUID()}`,
      displayName: 'Mock Bank Demo Account',
      connectionStatus: 'CONNECTED',
      isDefault: true,
    },
    select: { id: true },
  });
  createdAccountIds.push(account.id);
  return user.id;
}

function makeRequest(payerId: string, payeeId: string, overrides: Record<string, unknown> = {}) {
  return {
    payerId,
    payeeId,
    amountMinor: 1250,
    currency: 'EUR',
    idempotencyKey: `payment-key-${randomUUID()}`,
    ...overrides,
  };
}

async function createPayment(
  payerId: string,
  payeeId: string,
  overrides: Record<string, unknown> = {},
) {
  const payment = await paymentsService.createPayment(makeRequest(payerId, payeeId, overrides));
  createdPaymentIds.push(payment.id);
  return payment;
}

beforeAll(async () => {
  await database.client.$connect();
});

afterEach(async () => {
  if (createdPaymentIds.length > 0) {
    await database.client.auditEventRecord.deleteMany({
      where: { entityId: { in: createdPaymentIds } },
    });
    await database.client.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    createdPaymentIds.length = 0;
  }
  if (createdAccountIds.length > 0) {
    await database.client.linkedBankAccount.deleteMany({
      where: { id: { in: createdAccountIds } },
    });
    createdAccountIds.length = 0;
  }
  if (createdUserIds.length > 0) {
    await database.client.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

afterAll(async () => {
  await database.onModuleDestroy();
});

describe('PaymentsService', () => {
  it('creates an authorization-required simulated payment and safe audit trail', async () => {
    const payerId = await createParticipant();
    const payeeId = await createParticipant();
    const payment = await createPayment(payerId, payeeId);

    expect(payment).toMatchObject({
      payerId,
      payeeId,
      amountMinor: 1250,
      currency: 'EUR',
      state: PaymentState.RequiresAuthorization,
      simulation: true,
    });
    expect(payment).not.toHaveProperty('providerReference');
    expect(payment).not.toHaveProperty('payerAccountId');
    expect(payment).not.toHaveProperty('payeeAccountId');

    const events = await database.client.auditEventRecord.findMany({
      where: { entityId: payment.id },
      orderBy: { occurredAt: 'asc' },
      select: { eventType: true, metadata: true },
    });
    expect(events.map((event) => event.eventType)).toEqual([
      'PAYMENT_CREATED',
      'PAYMENT_AUTHORIZATION_REQUIRED',
    ]);
    expect(events[0]?.metadata).toMatchObject({ amountMinor: 1250, currency: 'EUR' });
  });

  it('returns the original payment on exact retries and rejects conflicting key reuse', async () => {
    const payerId = await createParticipant();
    const payeeId = await createParticipant();
    const request = makeRequest(payerId, payeeId);
    const first = await createPayment(payerId, payeeId, request);
    const retry = await paymentsService.createPayment(request);

    expect(retry.id).toBe(first.id);
    await expect(paymentsService.createPayment({ ...request, amountMinor: 2000 })).rejects.toThrow(
      'Idempotency key was already used with a different request.',
    );

    const count = await database.client.payment.count({
      where: { payerId, idempotencyKey: request.idempotencyKey as string },
    });
    expect(count).toBe(1);
  });

  it('does not create duplicate payments for concurrent identical requests', async () => {
    const payerId = await createParticipant();
    const payeeId = await createParticipant();
    const request = makeRequest(payerId, payeeId);

    const [first, second] = await Promise.all([
      paymentsService.createPayment(request),
      paymentsService.createPayment(request),
    ]);
    createdPaymentIds.push(first.id, second.id);

    expect(first.id).toBe(second.id);
    await expect(
      database.client.payment.count({
        where: { payerId, idempotencyKey: request.idempotencyKey as string },
      }),
    ).resolves.toBe(1);
  });

  it('simulates payer rejection without entering processing', async () => {
    const payerId = await createParticipant();
    const payeeId = await createParticipant();
    const payment = await createPayment(payerId, payeeId);

    const rejected = await paymentsService.authorizePayment(payment.id, {
      payerId,
      decision: 'REJECT',
      outcome: 'SUCCESS',
    });
    expect(rejected).toMatchObject({
      state: PaymentState.Rejected,
      failureCode: 'USER_REJECTED',
      simulation: true,
    });
    await expect(
      paymentsService.authorizePayment(payment.id, {
        payerId,
        decision: 'APPROVE',
        outcome: 'SUCCESS',
      }),
    ).rejects.toThrow('not awaiting authorization');
  });

  it.each([
    ['SUCCESS', PaymentState.Succeeded, null],
    ['PENDING', PaymentState.Processing, null],
    ['INSUFFICIENT_FUNDS', PaymentState.Failed, 'INSUFFICIENT_FUNDS'],
    ['PROVIDER_FAILURE', PaymentState.Failed, 'PROVIDER_FAILURE'],
  ] as const)(
    'simulates approved payment outcome %s',
    async (outcome, expectedState, expectedFailureCode) => {
      const payerId = await createParticipant();
      const payeeId = await createParticipant();
      const payment = await createPayment(payerId, payeeId);

      const result = await paymentsService.authorizePayment(payment.id, {
        payerId,
        decision: 'APPROVE',
        outcome,
      });
      expect(result).toMatchObject({
        state: expectedState,
        failureCode: expectedFailureCode,
        simulation: true,
      });
    },
  );

  it('requires verified, discoverable participants and connected default accounts', async () => {
    const payerId = await createParticipant();
    const unlistedPayeeId = await createParticipant(false);
    await expect(
      paymentsService.createPayment(makeRequest(payerId, unlistedPayeeId)),
    ).rejects.toThrow('Recipient not found.');

    const noAccountPayeeId = await createParticipant();
    const account = await database.client.linkedBankAccount.findFirstOrThrow({
      where: { userId: noAccountPayeeId },
      select: { id: true },
    });
    await database.client.linkedBankAccount.delete({ where: { id: account.id } });
    createdAccountIds.splice(createdAccountIds.indexOf(account.id), 1);
    await expect(
      paymentsService.createPayment(makeRequest(payerId, noAccountPayeeId)),
    ).rejects.toThrow('Recipient not found.');
  });

  it('lists transaction history only to a participant and does not expose bank references', async () => {
    const payerId = await createParticipant();
    const payeeId = await createParticipant();
    const unrelatedId = await createParticipant();
    const payment = await createPayment(payerId, payeeId);

    await expect(paymentsService.listPayments(payerId)).resolves.toMatchObject([
      { id: payment.id },
    ]);
    await expect(paymentsService.listPayments(payeeId)).resolves.toMatchObject([
      { id: payment.id },
    ]);
    await expect(paymentsService.listPayments(unrelatedId)).resolves.toEqual([]);
    expect(payment).not.toHaveProperty('providerReference');
    expect(payment).not.toHaveProperty('payerAccountId');
  });
});
