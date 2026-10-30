import 'reflect-metadata';
import { randomInt, randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DatabaseService } from '../src/database/database.service.js';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { MockBankConnector } from '../src/modules/banking/mock-bank-connector.js';
import { DevelopmentOnlyGuard } from '../src/modules/identity/development-only.guard.js';
import { PaymentRequestsController } from '../src/modules/payment-requests/payment-requests.controller.js';
import {
  CreatePaymentRequestDto,
  PaymentRequestActorDto,
} from '../src/modules/payment-requests/payment-requests.dto.js';
import { PaymentRequestsService } from '../src/modules/payment-requests/payment-requests.service.js';
import { PaymentsService } from '../src/modules/payments/payments.service.js';

const database = new DatabaseService();
const audit = new AuditService(database);
const payments = new PaymentsService(database, new MockBankConnector(), audit);
const requests = new PaymentRequestsService(database, payments, audit);
const userIds: string[] = [];

async function participant(listed = true) {
  const suffix = randomInt(100000, 1000000).toString();
  const user = await database.client.user.create({
    data: {
      username: `request_${randomUUID().slice(0, 12)}`,
      phoneNumber: `+38349${suffix}`,
      phoneVerifiedAt: new Date(),
      directoryListingEnabled: listed,
    },
  });
  userIds.push(user.id);
  await database.client.linkedBankAccount.create({
    data: {
      userId: user.id,
      connectorId: 'mock-bank',
      providerAccountReference: `mock_request_${randomUUID()}`,
      displayName: 'Mock Bank Demo Account',
      connectionStatus: 'CONNECTED',
      isDefault: true,
    },
  });
  return user.id;
}

function input(requesterId: string, payerId: string) {
  return {
    requesterId,
    payerId,
    amountMinor: 1234,
    currency: 'EUR',
    idempotencyKey: `request-test-${randomUUID()}`,
  };
}

async function pending() {
  const requesterId = await participant();
  const payerId = await participant();
  return requests.create(input(requesterId, payerId));
}

beforeAll(async () => {
  await database.client.$connect();
});
afterEach(async () => {
  vi.restoreAllMocks();
  const paymentRows = await database.client.payment.findMany({
    where: { payerId: { in: userIds } },
    select: { id: true },
  });
  const requestRows = await database.client.paymentRequest.findMany({
    where: { requesterId: { in: userIds } },
    select: { id: true },
  });
  await database.client.auditEventRecord.deleteMany({
    where: { entityId: { in: [...paymentRows, ...requestRows].map((row) => row.id) } },
  });
  await database.client.paymentRequest.deleteMany({ where: { requesterId: { in: userIds } } });
  await database.client.payment.deleteMany({ where: { payerId: { in: userIds } } });
  await database.client.linkedBankAccount.deleteMany({ where: { userId: { in: userIds } } });
  await database.client.user.deleteMany({ where: { id: { in: userIds } } });
  userIds.length = 0;
});
afterAll(async () => {
  await database.onModuleDestroy();
});

describe('payment request lifecycle', () => {
  it('creates a safe pending request, participant lists and an audit record', async () => {
    const request = await pending();
    expect(request).toMatchObject({
      state: 'PENDING',
      amountMinor: 1234,
      currency: 'EUR',
      payment: null,
      simulation: true,
    });
    expect(request.requester).toHaveProperty('username');
    expect(JSON.stringify(request)).not.toMatch(
      /phoneNumber|providerReference|AccountId|idempotencyKey/,
    );
    expect(await requests.list(request.payerId)).toHaveLength(1);
    expect(await requests.list(request.requesterId)).toHaveLength(1);
    expect((await requests.get(request.id, request.payerId)).id).toBe(request.id);
    expect(
      await database.client.auditEventRecord.count({
        where: { entityId: request.id, eventType: 'PAYMENT_REQUEST_CREATED' },
      }),
    ).toBe(1);
  });

  it('makes creation retries idempotent and rejects conflicting key reuse', async () => {
    const payload = input(await participant(), await participant());
    const [first, second] = await Promise.all([requests.create(payload), requests.create(payload)]);
    expect(first.id).toBe(second.id);
    await expect(requests.create({ ...payload, amountMinor: 999 })).rejects.toThrow('already used');
    expect(await database.client.auditEventRecord.count({ where: { entityId: first.id } })).toBe(1);
  });

  it.each([0, -1, 1.1, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid amount %s',
    async (amountMinor) => {
      await expect(
        requests.create({ ...input(randomUUID(), randomUUID()), amountMinor }),
      ).rejects.toThrow();
    },
  );

  it('rejects self requests and unsupported currency', async () => {
    const userId = await participant();
    await expect(requests.create(input(userId, userId))).rejects.toThrow('different payer');
    await expect(
      requests.create({ ...input(userId, randomUUID()), currency: 'USD' }),
    ).rejects.toThrow();
  });

  it('does not disclose private payers or accept unverified requesters', async () => {
    const requesterId = await participant();
    const privatePayer = await participant(false);
    await expect(requests.create(input(requesterId, privatePayer))).rejects.toThrow(
      'Recipient not found',
    );
    const payerId = await participant();
    await database.client.user.update({
      where: { id: requesterId },
      data: { phoneVerifiedAt: null },
    });
    await expect(requests.create(input(requesterId, payerId))).rejects.toThrow('verified phone');
  });

  it('accepts concurrently once, links one payment, and preserves retries after directory opt-out', async () => {
    const request = await pending();
    const [first, second] = await Promise.all([
      requests.accept(request.id, request.payerId),
      requests.accept(request.id, request.payerId),
    ]);
    expect(first).toMatchObject({
      state: 'ACCEPTED',
      payment: { amountMinor: 1234, state: 'REQUIRES_AUTHORIZATION', simulation: true },
    });
    expect(first.payment?.id).toBe(second.payment?.id);
    expect(await database.client.payment.count({ where: { payerId: request.payerId } })).toBe(1);
    expect(
      await database.client.auditEventRecord.count({
        where: { entityId: request.id, eventType: 'PAYMENT_REQUEST_ACCEPTED' },
      }),
    ).toBe(1);
    await database.client.user.update({
      where: { id: request.requesterId },
      data: { directoryListingEnabled: false },
    });
    expect((await requests.accept(request.id, request.payerId)).payment?.id).toBe(
      first.payment?.id,
    );
  });

  it.each(['SUCCESS', 'PENDING', 'INSUFFICIENT_FUNDS', 'PROVIDER_FAILURE'] as const)(
    'reports live linked payment outcome %s without marking acceptance paid',
    async (outcome) => {
      const request = await pending();
      const accepted = await requests.accept(request.id, request.payerId);
      if (!accepted.payment) throw new Error('Missing linked payment');
      const result = await payments.authorizePayment(accepted.payment.id, {
        payerId: request.payerId,
        decision: 'APPROVE',
        outcome,
      });
      const viewed = await requests.get(request.id, request.requesterId);
      expect(viewed.state).toBe('ACCEPTED');
      expect(viewed.payment?.state).toBe(result.state);
      expect(viewed.payment?.failureCode).toBe(result.failureCode);
    },
  );

  it('allows only the payer to reject, idempotently and without a payment', async () => {
    const request = await pending();
    await expect(requests.reject(request.id, request.requesterId)).rejects.toThrow('not found');
    expect((await requests.reject(request.id, request.payerId)).state).toBe('REJECTED');
    expect((await requests.reject(request.id, request.payerId)).state).toBe('REJECTED');
    await expect(requests.accept(request.id, request.payerId)).rejects.toThrow('no longer pending');
    expect(await database.client.payment.count({ where: { payerId: request.payerId } })).toBe(0);
    expect(
      await database.client.auditEventRecord.count({
        where: { entityId: request.id, eventType: 'PAYMENT_REQUEST_REJECTED' },
      }),
    ).toBe(1);
  });

  it('allows only the requester to cancel and never reopens a terminal request', async () => {
    const request = await pending();
    await expect(requests.cancel(request.id, request.payerId)).rejects.toThrow('not found');
    expect((await requests.cancel(request.id, request.requesterId)).state).toBe('CANCELLED');
    expect((await requests.cancel(request.id, request.requesterId)).state).toBe('CANCELLED');
    await expect(requests.reject(request.id, request.payerId)).rejects.toThrow('no longer pending');
    await expect(requests.accept(request.id, request.payerId)).rejects.toThrow('no longer pending');
  });

  it('blocks outsiders and requester-side acceptance', async () => {
    const request = await pending();
    const outsider = await participant();
    await expect(requests.get(request.id, outsider)).rejects.toThrow('not found');
    await expect(requests.accept(request.id, outsider)).rejects.toThrow('not found');
    await expect(requests.accept(request.id, request.requesterId)).rejects.toThrow('not found');
    await expect(requests.cancel(request.id, outsider)).rejects.toThrow('not found');
    expect(await requests.list(outsider)).toEqual([]);
  });

  it('revalidates accounts and directory at acceptance without changing the pending request', async () => {
    const request = await pending();
    await database.client.linkedBankAccount.updateMany({
      where: { userId: request.payerId },
      data: { connectionStatus: 'DISCONNECTED', isDefault: false },
    });
    await expect(requests.accept(request.id, request.payerId)).rejects.toThrow(
      'connected default account',
    );
    expect((await requests.get(request.id, request.payerId)).state).toBe('PENDING');
    expect(await database.client.payment.count({ where: { payerId: request.payerId } })).toBe(0);
  });

  it('requires requester discovery opt-in and rechecks it at acceptance', async () => {
    const requesterId = await participant(false);
    const payerId = await participant();
    await expect(requests.create(input(requesterId, payerId))).rejects.toThrow(
      'Enable recipient discovery',
    );
    await database.client.user.update({
      where: { id: requesterId },
      data: { directoryListingEnabled: true },
    });
    const request = await requests.create(input(requesterId, payerId));
    await database.client.user.update({
      where: { id: requesterId },
      data: { directoryListingEnabled: false },
    });
    await expect(requests.accept(request.id, payerId)).rejects.toThrow('Recipient not found');
    expect((await requests.get(request.id, payerId)).state).toBe('PENDING');
    expect(await database.client.payment.count({ where: { payerId } })).toBe(0);
  });

  it('serializes competing accept/cancel actions without an orphaned payment', async () => {
    const request = await pending();
    const results = await Promise.allSettled([
      requests.accept(request.id, request.payerId),
      requests.cancel(request.id, request.requesterId),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const final = await requests.get(request.id, request.payerId);
    expect(['ACCEPTED', 'CANCELLED']).toContain(final.state);
    expect(await database.client.payment.count({ where: { payerId: request.payerId } })).toBe(
      final.state === 'ACCEPTED' ? 1 : 0,
    );
    if (final.state === 'ACCEPTED')
      await expect(requests.cancel(request.id, request.requesterId)).rejects.toThrow(
        'no longer pending',
      );
  });

  it('rolls payment, request state and audit records back together if acceptance fails', async () => {
    const request = await pending();
    const original = audit.append.bind(audit);
    vi.spyOn(audit, 'append').mockImplementation(async (event, transaction) => {
      if (event.type === 'PAYMENT_REQUEST_ACCEPTED') throw new Error('Injected audit failure');
      return original(event, transaction);
    });
    await expect(requests.accept(request.id, request.payerId)).rejects.toThrow(
      'Injected audit failure',
    );
    expect((await requests.get(request.id, request.payerId)).state).toBe('PENDING');
    expect(await database.client.payment.count({ where: { payerId: request.payerId } })).toBe(0);
    expect(await database.client.auditEventRecord.count({ where: { entityId: request.id } })).toBe(
      1,
    );
  });
});

describe('payment request API boundaries', () => {
  it('applies the fail-closed development guard to the entire controller', () => {
    expect(Reflect.getMetadata('__guards__', PaymentRequestsController)).toContain(
      DevelopmentOnlyGuard,
    );
  });
  it('validates UUIDs, safe integer money, currency and idempotency keys', async () => {
    expect(
      await validate(plainToInstance(CreatePaymentRequestDto, input(randomUUID(), randomUUID()))),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(CreatePaymentRequestDto, {
          requesterId: 'bad',
          payerId: 'bad',
          amountMinor: 1.1,
          currency: 'USD',
          idempotencyKey: '!',
        }),
      ),
    ).toHaveLength(5);
    expect(await validate(plainToInstance(PaymentRequestActorDto, { userId: 'bad' }))).toHaveLength(
      1,
    );
  });
});
