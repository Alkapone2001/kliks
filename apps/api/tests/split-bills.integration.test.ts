import 'reflect-metadata';
import { randomInt, randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DatabaseService } from '../src/database/database.service.js';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { MockBankConnector } from '../src/modules/banking/mock-bank-connector.js';
import { DevelopmentOnlyGuard } from '../src/modules/identity/development-only.guard.js';
import { PaymentRequestsService } from '../src/modules/payment-requests/payment-requests.service.js';
import { PaymentsService } from '../src/modules/payments/payments.service.js';
import { SplitBillsController } from '../src/modules/split-bills/split-bills.controller.js';
import { CreateSplitBillDto } from '../src/modules/split-bills/split-bills.dto.js';
import { SplitBillsService } from '../src/modules/split-bills/split-bills.service.js';

const database = new DatabaseService();
const audit = new AuditService(database);
const payments = new PaymentsService(database, new MockBankConnector(), audit);
const requests = new PaymentRequestsService(database, payments, audit);
const bills = new SplitBillsService(database, requests, audit);
const userIds: string[] = [];
type Bill = Awaited<ReturnType<SplitBillsService['create']>>;

async function participant(listed = true, account = true) {
  const user = await database.client.user.create({
    data: {
      username: `bill_${randomUUID().slice(0, 15)}`,
      phoneNumber: `+38347${randomInt(100000, 1000000)}`,
      phoneVerifiedAt: new Date(),
      directoryListingEnabled: listed,
    },
  });
  userIds.push(user.id);
  if (account)
    await database.client.linkedBankAccount.create({
      data: {
        userId: user.id,
        connectorId: 'mock-bank',
        providerAccountReference: `mock_bill_${randomUUID()}`,
        displayName: 'Mock Bank Demo Account',
        connectionStatus: 'CONNECTED',
        isDefault: true,
      },
    });
  return user.id;
}

async function payload() {
  const creatorId = await participant();
  return {
    creatorId,
    title: 'Test lunch',
    totalMinor: 1001,
    currency: 'EUR',
    mode: 'EQUAL' as const,
    participants: [
      { userId: creatorId },
      { userId: await participant() },
      { userId: await participant() },
    ],
    idempotencyKey: `bill-test-${randomUUID()}`,
  };
}
function requested(bill: Bill, position = 1) {
  const share = bill.shares[position];
  if (!share?.request) throw new Error('Missing participant request');
  return { userId: share.user.id, requestId: share.request.id };
}

beforeAll(async () => {
  await database.client.$connect();
});
afterEach(async () => {
  vi.restoreAllMocks();
  const billRows = await database.client.splitBill.findMany({
    where: { creatorId: { in: userIds } },
    select: { id: true },
  });
  const requestRows = await database.client.paymentRequest.findMany({
    where: { requesterId: { in: userIds } },
    select: { id: true },
  });
  const paymentRows = await database.client.payment.findMany({
    where: { payerId: { in: userIds } },
    select: { id: true },
  });
  await database.client.auditEventRecord.deleteMany({
    where: { entityId: { in: [...billRows, ...requestRows, ...paymentRows].map((row) => row.id) } },
  });
  await database.client.splitBillShare.deleteMany({
    where: { billId: { in: billRows.map((row) => row.id) } },
  });
  await database.client.splitBill.deleteMany({ where: { creatorId: { in: userIds } } });
  await database.client.paymentRequest.deleteMany({ where: { requesterId: { in: userIds } } });
  await database.client.payment.deleteMany({ where: { payerId: { in: userIds } } });
  await database.client.linkedBankAccount.deleteMany({ where: { userId: { in: userIds } } });
  await database.client.user.deleteMany({ where: { id: { in: userIds } } });
  userIds.length = 0;
});
afterAll(async () => {
  await database.onModuleDestroy();
});

describe('split bills', () => {
  it('creates exact equal shares and one request per non-creator atomically', async () => {
    const bill = await bills.create(await payload());
    expect(bill.shares.map((share) => share.amountMinor)).toEqual([334, 334, 333]);
    expect(bill).toMatchObject({
      status: 'OPEN',
      requestedMinor: 667,
      settledMinor: 0,
      simulation: true,
    });
    expect(bill.shares[0]).toMatchObject({ ownShare: true, request: null });
    for (const share of bill.shares.slice(1)) {
      expect(share.request?.state).toBe('PENDING');
      const request = await requests.get(share.request?.id ?? '', share.user.id);
      expect(request.splitBill).toEqual({ id: bill.id, title: bill.title });
      expect(request).toMatchObject({
        requesterId: bill.creatorId,
        payerId: share.user.id,
        amountMinor: share.amountMinor,
      });
    }
    expect(JSON.stringify(bill)).not.toMatch(
      /phoneNumber|AccountId|providerReference|idempotencyKey|requestFingerprint/,
    );
    expect(
      await database.client.auditEventRecord.count({
        where: { entityId: bill.id, eventType: 'SPLIT_BILL_CREATED' },
      }),
    ).toBe(1);
  });

  it('creates exact custom shares and puts the creator first', async () => {
    const input = await payload();
    const bill = await bills.create({
      ...input,
      mode: 'CUSTOM',
      participants: input.participants
        .map((entry, index) => ({ ...entry, amountMinor: [500, 300, 201][index] ?? 0 }))
        .reverse(),
    });
    expect(bill.shares[0]).toMatchObject({
      user: { id: input.creatorId },
      amountMinor: 500,
      request: null,
    });
    expect(bill.shares.reduce((total, share) => total + share.amountMinor, 0)).toBe(1001);
  });

  it('rejects custom mismatches, duplicate participants, missing creator and wrong currency', async () => {
    const input = await payload();
    await expect(
      bills.create({
        ...input,
        mode: 'CUSTOM',
        participants: input.participants.map((entry) => ({ ...entry, amountMinor: 100 })),
      }),
    ).rejects.toThrow('add up exactly');
    await expect(
      bills.create({ ...input, participants: [input.participants[0]!, input.participants[0]!] }),
    ).rejects.toThrow('distinct');
    await expect(
      bills.create({ ...input, participants: input.participants.slice(1) }),
    ).rejects.toThrow('creator share');
    await expect(bills.create({ ...input, currency: 'USD' })).rejects.toThrow();
    expect(
      await database.client.paymentRequest.count({ where: { requesterId: input.creatorId } }),
    ).toBe(0);
  });

  it.each([0, -1, 0.1, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid total %s',
    async (totalMinor) => {
      const input = {
        creatorId: randomUUID(),
        title: 'Test',
        totalMinor,
        currency: 'EUR',
        mode: 'EQUAL' as const,
        participants: [] as { userId: string }[],
        idempotencyKey: randomUUID(),
      };
      input.participants = [{ userId: input.creatorId }, { userId: randomUUID() }];
      await expect(bills.create(input)).rejects.toThrow();
    },
  );

  it('makes concurrent creation retries safe and detects changed bill content', async () => {
    const input = await payload();
    const [first, second] = await Promise.all([bills.create(input), bills.create(input)]);
    expect(first.id).toBe(second.id);
    expect(
      await database.client.paymentRequest.count({ where: { requesterId: input.creatorId } }),
    ).toBe(2);
    await expect(bills.create({ ...input, title: 'Changed bill' })).rejects.toThrow(
      'different bill',
    );
    await expect(bills.create({ ...input, totalMinor: 2000 })).rejects.toThrow('different bill');
  });

  it('requires verified/discoverable participants without partial bill creation', async () => {
    const input = await payload();
    const hidden = await participant(false);
    await expect(
      bills.create({ ...input, participants: [{ userId: input.creatorId }, { userId: hidden }] }),
    ).rejects.toThrow('Participant not found');
    await database.client.user.update({
      where: { id: input.creatorId },
      data: { directoryListingEnabled: false },
    });
    await expect(bills.create(input)).rejects.toThrow('recipient discovery');
    expect(await database.client.splitBill.count({ where: { creatorId: input.creatorId } })).toBe(
      0,
    );
    expect(
      await database.client.paymentRequest.count({ where: { requesterId: input.creatorId } }),
    ).toBe(0);
  });

  it('limits views to participants and cancellation to the creator', async () => {
    const bill = await bills.create(await payload());
    const payer = requested(bill);
    const outsider = await participant();
    expect((await bills.get(bill.id, payer.userId)).id).toBe(bill.id);
    expect(await bills.list(payer.userId)).toHaveLength(1);
    expect(await bills.list(outsider)).toEqual([]);
    await expect(bills.get(bill.id, outsider)).rejects.toThrow('not found');
    await expect(bills.cancel(bill.id, payer.userId)).rejects.toThrow('not found');
  });

  it('cancels pending requests together, idempotently and without reopening on creation retry', async () => {
    const input = await payload();
    const bill = await bills.create(input);
    expect((await bills.cancel(bill.id, bill.creatorId)).status).toBe('CANCELLED');
    const retry = await bills.cancel(bill.id, bill.creatorId);
    expect(
      retry.shares
        .filter((share) => share.request)
        .every((share) => share.request?.state === 'CANCELLED'),
    ).toBe(true);
    expect((await bills.create(input)).status).toBe('CANCELLED');
    const share = requested(bill);
    await expect(requests.accept(share.requestId, share.userId)).rejects.toThrow(
      'no longer pending',
    );
    expect(
      await database.client.auditEventRecord.count({
        where: { entityId: bill.id, eventType: 'SPLIT_BILL_CANCELLED' },
      }),
    ).toBe(1);
  });

  it('does not count acceptance as settlement or allow cancellation after acceptance', async () => {
    const bill = await bills.create(await payload());
    const share = requested(bill);
    await requests.accept(share.requestId, share.userId);
    expect(await bills.get(bill.id, bill.creatorId)).toMatchObject({
      status: 'IN_PROGRESS',
      settledMinor: 0,
      canCancel: false,
    });
    await expect(bills.cancel(bill.id, bill.creatorId)).rejects.toThrow(
      'after a share has been accepted',
    );
  });

  it('reports partial and full simulated settlement from live payment states', async () => {
    const bill = await bills.create(await payload());
    for (const position of [1, 2]) {
      const share = requested(bill, position);
      const accepted = await requests.accept(share.requestId, share.userId);
      if (!accepted.payment) throw new Error('Missing linked payment');
      await payments.authorizePayment(accepted.payment.id, {
        payerId: share.userId,
        decision: 'APPROVE',
        outcome: 'SUCCESS',
      });
      const current = await bills.get(bill.id, bill.creatorId);
      expect(current.status).toBe(position === 1 ? 'PARTIALLY_SETTLED' : 'SETTLED');
      expect(current.settledMinor).toBe(position === 1 ? 334 : 667);
    }
  });

  it.each(['PENDING', 'INSUFFICIENT_FUNDS', 'PROVIDER_FAILURE'] as const)(
    'reports non-settled outcome %s',
    async (outcome) => {
      const bill = await bills.create(await payload());
      const share = requested(bill);
      const accepted = await requests.accept(share.requestId, share.userId);
      if (!accepted.payment) throw new Error('Missing linked payment');
      await payments.authorizePayment(accepted.payment.id, {
        payerId: share.userId,
        decision: 'APPROVE',
        outcome,
      });
      const current = await bills.get(bill.id, bill.creatorId);
      expect(current.settledMinor).toBe(0);
      expect(current.status).toBe(outcome === 'PENDING' ? 'IN_PROGRESS' : 'NEEDS_ATTENTION');
    },
  );

  it('preserves a rejected share while cancelling remaining pending shares', async () => {
    const bill = await bills.create(await payload());
    const share = requested(bill);
    await requests.reject(share.requestId, share.userId);
    expect((await bills.get(bill.id, bill.creatorId)).status).toBe('NEEDS_ATTENTION');
    const cancelled = await bills.cancel(bill.id, bill.creatorId);
    expect(cancelled.shares[1]?.request?.state).toBe('REJECTED');
    expect(cancelled.shares[2]?.request?.state).toBe('CANCELLED');
  });

  it('serializes competing bill cancellation and share acceptance', async () => {
    const bill = await bills.create(await payload());
    const share = requested(bill);
    const results = await Promise.allSettled([
      bills.cancel(bill.id, bill.creatorId),
      requests.accept(share.requestId, share.userId),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const current = await bills.get(bill.id, bill.creatorId);
    expect(await database.client.payment.count({ where: { payerId: share.userId } })).toBe(
      current.state === 'CANCELLED' ? 0 : 1,
    );
    expect(current.shares[1]?.request?.state).toBe(
      current.state === 'CANCELLED' ? 'CANCELLED' : 'ACCEPTED',
    );
  });

  it('rolls bill, shares, requests and audit back together on creation failure', async () => {
    const input = await payload();
    const original = audit.append.bind(audit);
    vi.spyOn(audit, 'append').mockImplementation(async (event, transaction) => {
      if (event.type === 'SPLIT_BILL_CREATED') throw new Error('Injected bill creation failure');
      return original(event, transaction);
    });
    await expect(bills.create(input)).rejects.toThrow('Injected bill creation failure');
    expect(await database.client.splitBill.count({ where: { creatorId: input.creatorId } })).toBe(
      0,
    );
    expect(
      await database.client.paymentRequest.count({ where: { requesterId: input.creatorId } }),
    ).toBe(0);
    expect(await database.client.splitBillShare.count({ where: { userId: input.creatorId } })).toBe(
      0,
    );
  });

  it('rolls all pending-request cancellations back if bill audit fails', async () => {
    const bill = await bills.create(await payload());
    const original = audit.append.bind(audit);
    vi.spyOn(audit, 'append').mockImplementation(async (event, transaction) => {
      if (event.type === 'SPLIT_BILL_CANCELLED')
        throw new Error('Injected bill cancellation failure');
      return original(event, transaction);
    });
    await expect(bills.cancel(bill.id, bill.creatorId)).rejects.toThrow(
      'Injected bill cancellation failure',
    );
    const current = await bills.get(bill.id, bill.creatorId);
    expect(current.state).toBe('OPEN');
    expect(
      current.shares
        .filter((share) => share.request)
        .every((share) => share.request?.state === 'PENDING'),
    ).toBe(true);
  });
});

describe('split bill API boundaries', () => {
  it('guards all routes and validates nested participants, money and mode', async () => {
    expect(Reflect.getMetadata('__guards__', SplitBillsController)).toContain(DevelopmentOnlyGuard);
    const input = {
      creatorId: randomUUID(),
      title: 'Lunch',
      totalMinor: 100,
      currency: 'EUR',
      mode: 'EQUAL',
      participants: [{ userId: randomUUID() }, { userId: randomUUID() }],
      idempotencyKey: randomUUID(),
    };
    expect(await validate(plainToInstance(CreateSplitBillDto, input))).toEqual([]);
    const invalid = await validate(
      plainToInstance(CreateSplitBillDto, {
        ...input,
        participants: [{ userId: 'bad' }],
        totalMinor: 1.1,
        mode: 'INVALID',
      }),
    );
    expect(invalid.map((error) => error.property)).toEqual(
      expect.arrayContaining(['participants', 'totalMinor', 'mode']),
    );
    expect(
      await validate(plainToInstance(CreateSplitBillDto, { ...input, state: 'SETTLED' }), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    ).toHaveLength(1);
  });
});
