import 'reflect-metadata';
import { randomInt, randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DatabaseService } from '../src/database/database.service.js';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { MockBankConnector } from '../src/modules/banking/mock-bank-connector.js';
import { DevelopmentOnlyGuard } from '../src/modules/identity/development-only.guard.js';
import { PaymentsService } from '../src/modules/payments/payments.service.js';
import { QrPaymentsController } from '../src/modules/qr-payments/qr-payments.controller.js';
import {
  CreateQrPaymentDto,
  PayQrPaymentDto,
  ResolveQrPaymentDto,
} from '../src/modules/qr-payments/qr-payments.dto.js';
import { QrPaymentsService } from '../src/modules/qr-payments/qr-payments.service.js';

const database = new DatabaseService();
const audit = new AuditService(database);
const payments = new PaymentsService(database, new MockBankConnector(), audit);
const qr = new QrPaymentsService(database, payments, audit);
const userIds: string[] = [];

async function participant(listed = true) {
  const suffix = randomInt(100000, 1000000).toString();
  const user = await database.client.user.create({
    data: {
      username: `qr_${randomUUID().slice(0, 15)}`,
      phoneNumber: `+38348${suffix}`,
      phoneVerifiedAt: new Date(),
      directoryListingEnabled: listed,
    },
  });
  userIds.push(user.id);
  await database.client.linkedBankAccount.create({
    data: {
      userId: user.id,
      connectorId: 'mock-bank',
      providerAccountReference: `mock_qr_${randomUUID()}`,
      displayName: 'Mock Bank Demo Account',
      connectionStatus: 'CONNECTED',
      isDefault: true,
    },
  });
  return user.id;
}

async function code(amountMinor: number | null = 1234) {
  return qr.create({
    ownerId: await participant(),
    amountMinor,
    currency: 'EUR',
    idempotencyKey: `qr-test-${randomUUID()}`,
  });
}

async function expire(id: string) {
  await database.client.qrPaymentSession.update({
    where: { id },
    data: { createdAt: new Date(Date.now() - 3600000), expiresAt: new Date(Date.now() - 1000) },
  });
}

beforeAll(async () => {
  await database.client.$connect();
});
afterEach(async () => {
  vi.restoreAllMocks();
  const sessions = await database.client.qrPaymentSession.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  });
  const paymentRows = await database.client.payment.findMany({
    where: { payerId: { in: userIds } },
    select: { id: true },
  });
  await database.client.auditEventRecord.deleteMany({
    where: { entityId: { in: [...sessions, ...paymentRows].map((row) => row.id) } },
  });
  await database.client.qrPaymentSession.deleteMany({ where: { ownerId: { in: userIds } } });
  await database.client.payment.deleteMany({ where: { payerId: { in: userIds } } });
  await database.client.linkedBankAccount.deleteMany({ where: { userId: { in: userIds } } });
  await database.client.user.deleteMany({ where: { id: { in: userIds } } });
  userIds.length = 0;
});
afterAll(async () => {
  await database.onModuleDestroy();
});

describe('QR payment sessions', () => {
  it('creates a local QR PNG with only an opaque payload and 15-minute expiry', async () => {
    const session = await code();
    expect(session.payload).toBe(`kliks:pay:v1:${session.id}`);
    expect(session.imageDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(
      Buffer.from(session.imageDataUrl.split(',')[1] ?? '', 'base64')
        .subarray(1, 4)
        .toString(),
    ).toBe('PNG');
    expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBe(900000);
    expect(session).toMatchObject({
      state: 'AVAILABLE',
      amountMinor: 1234,
      currency: 'EUR',
      paymentId: null,
      simulation: true,
    });
    expect(JSON.stringify(session)).not.toMatch(
      /phoneNumber|providerReference|idempotencyKey|AccountId/,
    );
    expect(
      await database.client.auditEventRecord.count({
        where: { entityId: session.id, eventType: 'QR_PAYMENT_CREATED' },
      }),
    ).toBe(1);
  });

  it('reuses concurrent creation retries and rejects conflicting amount reuse', async () => {
    const input = {
      ownerId: await participant(),
      amountMinor: 100,
      currency: 'EUR',
      idempotencyKey: `qr-key-${randomUUID()}`,
    };
    const [first, second] = await Promise.all([qr.create(input), qr.create(input)]);
    expect(first.id).toBe(second.id);
    await expect(qr.create({ ...input, amountMinor: 200 })).rejects.toThrow('already used');
    expect(
      await database.client.qrPaymentSession.count({ where: { ownerId: input.ownerId } }),
    ).toBe(1);
  });

  it('requires verified, discoverable owners and keeps owner views private', async () => {
    const ownerId = await participant(false);
    await expect(
      qr.create({ ownerId, currency: 'EUR', idempotencyKey: randomUUID() }),
    ).rejects.toThrow('recipient discovery');
    const session = await code();
    expect(await qr.list(session.ownerId)).toHaveLength(1);
    expect((await qr.get(session.id, session.ownerId)).id).toBe(session.id);
    await expect(qr.get(session.id, ownerId)).rejects.toThrow('unavailable');
  });

  it.each([0, -1, 0.1, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid proposed/confirmed money %s',
    async (amountMinor) => {
      await expect(
        qr.create({
          ownerId: randomUUID(),
          amountMinor,
          currency: 'EUR',
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
      await expect(
        qr.pay(`kliks:pay:v1:${randomUUID()}`, randomUUID(), amountMinor),
      ).rejects.toThrow();
    },
  );

  it('rejects non-EUR generation even without a proposed amount', async () => {
    await expect(
      qr.create({ ownerId: randomUUID(), currency: 'USD', idempotencyKey: randomUUID() }),
    ).rejects.toThrow();
  });

  it('resolves a safe verified preview without consuming the session', async () => {
    const session = await code();
    const payerId = await participant(false);
    const preview = await qr.resolve(session.payload, payerId);
    expect(preview).toMatchObject({
      recipient: { id: session.ownerId, phoneVerified: true },
      amountMinor: 1234,
      simulation: true,
    });
    expect(JSON.stringify(preview)).not.toMatch(/phoneNumber|Account|provider|idempotency/);
    expect((await qr.get(session.id, session.ownerId)).state).toBe('AVAILABLE');
    expect(await database.client.payment.count({ where: { payerId } })).toBe(0);
  });

  it('rejects self-scanning and unverified payers', async () => {
    const session = await code();
    await expect(qr.resolve(session.payload, session.ownerId)).rejects.toThrow(
      'different recipient',
    );
    const payerId = await participant();
    await database.client.user.update({ where: { id: payerId }, data: { phoneVerifiedAt: null } });
    await expect(qr.resolve(session.payload, payerId)).rejects.toThrow('verified phone');
    await expect(qr.pay(session.payload, payerId, 1234)).rejects.toThrow('verified phone');
  });

  it('does not trust changes to fixed QR amounts', async () => {
    const session = await code();
    await expect(qr.pay(session.payload, await participant(), 1)).rejects.toThrow(
      'match the QR amount',
    );
    expect((await qr.get(session.id, session.ownerId)).state).toBe('AVAILABLE');
  });

  it('allows the payer to choose an amount only for an open-amount session', async () => {
    const session = await code(null);
    const payerId = await participant();
    expect((await qr.resolve(session.payload, payerId)).amountMinor).toBeNull();
    expect(await qr.pay(session.payload, payerId, 555)).toMatchObject({
      amountMinor: 555,
      payeeId: session.ownerId,
      state: 'REQUIRES_AUTHORIZATION',
    });
  });

  it('consumes once, makes exact payer retries safe, and forbids replay by another payer', async () => {
    const session = await code();
    const payerId = await participant();
    const [first, second] = await Promise.all([
      qr.pay(session.payload, payerId, 1234),
      qr.pay(session.payload, payerId, 1234),
    ]);
    expect(first.id).toBe(second.id);
    expect(await database.client.payment.count({ where: { payeeId: session.ownerId } })).toBe(1);
    expect((await qr.get(session.id, session.ownerId)).state).toBe('USED');
    await expect(qr.resolve(session.payload, payerId)).rejects.toThrow('unavailable');
    await expect(qr.pay(session.payload, await participant(), 1234)).rejects.toThrow('unavailable');
    await expect(qr.pay(session.payload, payerId, 100)).rejects.toThrow('different amount');
    expect(
      await database.client.auditEventRecord.count({
        where: { entityId: session.id, eventType: 'QR_PAYMENT_CONSUMED' },
      }),
    ).toBe(1);
  });

  it('serializes competing payers so exactly one wins', async () => {
    const session = await code();
    const results = await Promise.allSettled([
      qr.pay(session.payload, await participant(), 1234),
      qr.pay(session.payload, await participant(), 1234),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await database.client.payment.count({ where: { payeeId: session.ownerId } })).toBe(1);
  });

  it('rechecks expiry after a successful scan and creates no expired payment', async () => {
    const session = await code();
    const payerId = await participant();
    await qr.resolve(session.payload, payerId);
    await expire(session.id);
    await expect(qr.resolve(session.payload, payerId)).rejects.toThrow('unavailable');
    await expect(qr.pay(session.payload, payerId, 1234)).rejects.toThrow('unavailable');
    expect((await qr.get(session.id, session.ownerId)).state).toBe('EXPIRED');
    expect(await database.client.payment.count({ where: { payerId } })).toBe(0);
  });

  it('returns an existing payment on exact lost-response retry even after expiry', async () => {
    const session = await code();
    const payerId = await participant();
    const payment = await qr.pay(session.payload, payerId, 1234);
    await expire(session.id);
    expect((await qr.pay(session.payload, payerId, 1234)).id).toBe(payment.id);
  });

  it('rechecks opt-out and account availability at confirmation', async () => {
    const session = await code();
    const payerId = await participant();
    await qr.resolve(session.payload, payerId);
    await database.client.user.update({
      where: { id: session.ownerId },
      data: { directoryListingEnabled: false },
    });
    await expect(qr.pay(session.payload, payerId, 1234)).rejects.toThrow('unavailable');
    expect((await qr.get(session.id, session.ownerId)).state).toBe('UNAVAILABLE');
    await database.client.user.update({
      where: { id: session.ownerId },
      data: { directoryListingEnabled: true },
    });
    await database.client.linkedBankAccount.updateMany({
      where: { userId: payerId },
      data: { connectionStatus: 'DISCONNECTED', isDefault: false },
    });
    await expect(qr.pay(session.payload, payerId, 1234)).rejects.toThrow(
      'connected default account',
    );
    expect((await qr.get(session.id, session.ownerId)).state).toBe('AVAILABLE');
  });

  it('rolls consumption, payment and audit back together on audit failure', async () => {
    const session = await code();
    const payerId = await participant();
    const original = audit.append.bind(audit);
    vi.spyOn(audit, 'append').mockImplementation(async (event, transaction) => {
      if (event.type === 'QR_PAYMENT_CONSUMED') throw new Error('Injected QR audit failure');
      return original(event, transaction);
    });
    await expect(qr.pay(session.payload, payerId, 1234)).rejects.toThrow(
      'Injected QR audit failure',
    );
    expect((await qr.get(session.id, session.ownerId)).state).toBe('AVAILABLE');
    expect(await database.client.payment.count({ where: { payerId } })).toBe(0);
    expect(await database.client.auditEventRecord.count({ where: { entityId: session.id } })).toBe(
      1,
    );
  });

  it('retains the payment authorization boundary and live idempotent retry status', async () => {
    const session = await code();
    const payerId = await participant();
    const payment = await qr.pay(session.payload, payerId, 1234);
    expect(payment.state).toBe('REQUIRES_AUTHORIZATION');
    await payments.authorizePayment(payment.id, {
      payerId,
      decision: 'APPROVE',
      outcome: 'SUCCESS',
    });
    expect((await qr.pay(session.payload, payerId, 1234)).state).toBe('SUCCEEDED');
  });

  it.each([
    'https://example.com',
    'kliks:pay:v2:bad',
    'kliks:pay:v1:bad',
    `kliks:pay:v1:${randomUUID()}?amount=1`,
  ])('rejects unsupported payload %s', async (payload) => {
    await expect(qr.resolve(payload, randomUUID())).rejects.toThrow('unavailable');
  });
});

describe('QR API boundaries', () => {
  it('guards all routes and validates opaque payloads without accepting client destinations', async () => {
    expect(Reflect.getMetadata('__guards__', QrPaymentsController)).toContain(DevelopmentOnlyGuard);
    const payload = `kliks:pay:v1:${randomUUID()}`;
    expect(
      await validate(plainToInstance(ResolveQrPaymentDto, { payload, payerId: randomUUID() })),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(CreateQrPaymentDto, {
          ownerId: randomUUID(),
          currency: 'EUR',
          idempotencyKey: randomUUID(),
        }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(PayQrPaymentDto, {
          payload,
          payerId: randomUUID(),
          amountMinor: 1,
          payeeId: randomUUID(),
        }),
        { whitelist: true, forbidNonWhitelisted: true },
      ),
    ).toHaveLength(1);
    expect(
      await validate(
        plainToInstance(PayQrPaymentDto, {
          payload: 'https://example.com',
          payerId: 'bad',
          amountMinor: 1.1,
        }),
      ),
    ).toHaveLength(3);
  });
});
