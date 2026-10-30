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
import { PaymentRequestsService } from '../src/modules/payment-requests/payment-requests.service.js';
import { QrPaymentsService } from '../src/modules/qr-payments/qr-payments.service.js';
import { MerchantsService } from '../src/modules/merchants/merchants.service.js';
import { MerchantsController } from '../src/modules/merchants/merchants.controller.js';
import {
  MerchantCheckoutDto,
  MerchantMemberDto,
  MerchantRequestDto,
} from '../src/modules/merchants/merchants.dto.js';

const database = new DatabaseService();
const audit = new AuditService(database);
const payments = new PaymentsService(database, new MockBankConnector(), audit);
const requests = new PaymentRequestsService(database, payments, audit);
const qr = new QrPaymentsService(database, payments, audit);
const merchants = new MerchantsService(database, requests, qr, audit);
const userIds: string[] = [];

async function participant(listed = true) {
  const user = await database.client.user.create({
    data: {
      username: `merchant_${randomUUID().slice(0, 12)}`,
      phoneNumber: `+38346${randomInt(100000, 1000000)}`,
      phoneVerifiedAt: new Date(),
      directoryListingEnabled: listed,
    },
  });
  userIds.push(user.id);
  await database.client.linkedBankAccount.create({
    data: {
      userId: user.id,
      connectorId: 'mock-bank',
      providerAccountReference: `mock_merchant_${randomUUID()}`,
      displayName: 'Mock Bank Demo Account',
      connectionStatus: 'CONNECTED',
      isDefault: true,
    },
  });
  return user.id;
}
async function shop() {
  return merchants.create(await participant(), 'Test Merchant');
}

beforeAll(async () => {
  await database.client.$connect();
});
afterEach(async () => {
  vi.restoreAllMocks();
  const profiles = await database.client.merchantProfile.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  });
  const ids = profiles.map((profile) => profile.id);
  const requestRows = await database.client.paymentRequest.findMany({
    where: { requesterId: { in: userIds } },
    select: { id: true },
  });
  const sessions = await database.client.qrPaymentSession.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  });
  const paymentRows = await database.client.payment.findMany({
    where: { payerId: { in: userIds } },
    select: { id: true },
  });
  await database.client.auditEventRecord.deleteMany({
    where: {
      entityId: {
        in: [...profiles, ...requestRows, ...sessions, ...paymentRows].map((row) => row.id),
      },
    },
  });
  await database.client.merchantRequest.deleteMany({ where: { merchantId: { in: ids } } });
  await database.client.qrPaymentSession.deleteMany({ where: { ownerId: { in: userIds } } });
  await database.client.paymentRequest.deleteMany({ where: { requesterId: { in: userIds } } });
  await database.client.payment.deleteMany({ where: { payerId: { in: userIds } } });
  await database.client.merchantMembership.deleteMany({ where: { merchantId: { in: ids } } });
  await database.client.merchantProfile.deleteMany({ where: { id: { in: ids } } });
  await database.client.linkedBankAccount.deleteMany({ where: { userId: { in: userIds } } });
  await database.client.user.deleteMany({ where: { id: { in: userIds } } });
  userIds.length = 0;
});
afterAll(async () => {
  await database.onModuleDestroy();
});

describe('merchant foundation', () => {
  it('creates one safe profile per owner with concurrent retry safety', async () => {
    const owner = await participant();
    const [first, second] = await Promise.all([
      merchants.create(owner, 'Test Shop'),
      merchants.create(owner, 'Test Shop'),
    ]);
    expect(first.id).toBe(second.id);
    expect(first).toMatchObject({ role: 'OWNER', simulation: true, refunds: { available: false } });
    expect(JSON.stringify(first)).not.toMatch(
      /phoneNumber|providerReference|AccountId|directoryListing/,
    );
    expect(await database.client.merchantProfile.count({ where: { ownerId: owner } })).toBe(1);
    expect(
      await database.client.auditEventRecord.count({
        where: { entityId: first.id, eventType: 'MERCHANT_CREATED' },
      }),
    ).toBe(1);
    await expect(merchants.create(owner, 'Different Shop')).rejects.toThrow('already exists');
  });
  it('requires verified discoverable owners and bounded names', async () => {
    const owner = await participant(false);
    await expect(merchants.create(owner, 'Test Shop')).rejects.toThrow('recipient discovery');
    await expect(merchants.create(owner, ' ')).rejects.toThrow('merchant name');
    await expect(merchants.create(owner, 'x'.repeat(81))).rejects.toThrow('merchant name');
  });
  it('keeps owner authority immutable and restricts profile/team changes', async () => {
    const merchant = await shop();
    const manager = await participant();
    await merchants.member(merchant.id, merchant.owner.id, manager, 'MANAGER');
    const roleAudit = await database.client.auditEventRecord.findFirst({
      where: { entityId: merchant.id, eventType: 'MERCHANT_ROLE_CHANGED' },
    });
    expect(roleAudit?.metadata).toMatchObject({
      memberId: manager,
      role: 'MANAGER',
      actorId: merchant.owner.id,
    });
    await expect(
      merchants.member(merchant.id, manager, merchant.owner.id, 'VIEWER'),
    ).rejects.toThrow('role');
    await expect(merchants.update(merchant.id, manager, 'Bad rename')).rejects.toThrow('role');
    await expect(
      merchants.member(merchant.id, merchant.owner.id, merchant.owner.id, 'REMOVE'),
    ).rejects.toThrow('owner role');
    expect(
      (await merchants.update(merchant.id, merchant.owner.id, 'Renamed Shop')).displayName,
    ).toBe('Renamed Shop');
  });
  it('restricts viewers to reads and removes access immediately on revocation', async () => {
    const merchant = await shop();
    const viewer = await participant();
    await merchants.member(merchant.id, merchant.owner.id, viewer, 'VIEWER');
    expect((await merchants.get(merchant.id, viewer)).role).toBe('VIEWER');
    expect(await merchants.list(viewer)).toHaveLength(1);
    await expect(
      merchants.request(merchant.id, viewer, await participant(), 100, 'EUR', randomUUID()),
    ).rejects.toThrow('role');
    await expect(
      merchants.dynamicQr(merchant.id, viewer, 100, 'EUR', randomUUID()),
    ).rejects.toThrow('role');
    await merchants.member(merchant.id, merchant.owner.id, viewer, 'REMOVE');
    await expect(merchants.get(merchant.id, viewer)).rejects.toThrow('not found');
    await expect(merchants.history(merchant.id, viewer)).rejects.toThrow('not found');
  });
  it('hides profiles and history from outsiders', async () => {
    const merchant = await shop();
    const outsider = await participant();
    expect(await merchants.list(outsider)).toEqual([]);
    await expect(merchants.get(merchant.id, outsider)).rejects.toThrow('not found');
    await expect(merchants.staticQr(merchant.id, outsider)).rejects.toThrow('not found');
    await expect(merchants.history(merchant.id, outsider)).rejects.toThrow('not found');
  });
  it('lets managers request payment only to the merchant owner with safe context', async () => {
    const merchant = await shop();
    const manager = await participant();
    const customer = await participant();
    await merchants.member(merchant.id, merchant.owner.id, manager, 'MANAGER');
    const key = randomUUID();
    const first = await merchants.request(merchant.id, manager, customer, 1234, 'EUR', key);
    const retry = await merchants.request(merchant.id, manager, customer, 1234, 'EUR', key);
    expect(first.id).toBe(retry.id);
    expect(first.requesterId).toBe(merchant.owner.id);
    const viewed = await requests.get(first.id, customer);
    expect(viewed.merchant).toEqual({ id: merchant.id, displayName: merchant.displayName });
    const accepted = await requests.accept(first.id, customer);
    expect(accepted.payment?.payeeId).toBe(merchant.owner.id);
    await expect(
      merchants.request(merchant.id, manager, customer, 999, 'EUR', key),
    ).rejects.toThrow('already used');
    expect((await merchants.history(merchant.id, manager)).requests).toHaveLength(1);
  });
  it('cancels only linked pending merchant requests through authorized roles', async () => {
    const merchant = await shop();
    const customer = await participant();
    const linked = await merchants.request(
      merchant.id,
      merchant.owner.id,
      customer,
      100,
      'EUR',
      randomUUID(),
    );
    const personal = await requests.create({
      requesterId: merchant.owner.id,
      payerId: customer,
      amountMinor: 100,
      currency: 'EUR',
      idempotencyKey: randomUUID(),
    });
    await expect(
      merchants.cancelRequest(merchant.id, merchant.owner.id, personal.id),
    ).rejects.toThrow('not found');
    expect((await merchants.cancelRequest(merchant.id, merchant.owner.id, linked.id)).state).toBe(
      'CANCELLED',
    );
    expect((await requests.get(personal.id, customer)).state).toBe('PENDING');
  });
  it('creates attributed fixed-amount single-use dynamic QR codes', async () => {
    const merchant = await shop();
    const customer = await participant();
    const key = randomUUID();
    const code = await merchants.dynamicQr(merchant.id, merchant.owner.id, 555, 'EUR', key);
    expect((await merchants.dynamicQr(merchant.id, merchant.owner.id, 555, 'EUR', key)).id).toBe(
      code.id,
    );
    const preview = await qr.resolve(code.payload, customer);
    expect(preview.merchant).toEqual({ id: merchant.id, displayName: merchant.displayName });
    expect(preview.amountMinor).toBe(555);
    await expect(qr.pay(code.payload, customer, 1)).rejects.toThrow('match the QR amount');
    const payment = await qr.pay(code.payload, customer, 555);
    expect(payment.payeeId).toBe(merchant.owner.id);
    await expect(qr.resolve(code.payload, customer)).rejects.toThrow('unavailable');
  });
  it('keeps static QR reusable while each checkout remains expiring and single-use', async () => {
    const merchant = await shop();
    const customer = await participant();
    const code = await merchants.staticQr(merchant.id, merchant.owner.id);
    expect(code.payload).toBe(`kliks:merchant:v1:${merchant.id}`);
    expect(code.imageDataUrl).toMatch(/^data:image\/png/);
    const key = randomUUID();
    const first = await merchants.checkout(code.payload, customer, key);
    expect((await merchants.checkout(code.payload, customer, key)).id).toBe(first.id);
    expect(first.merchant.displayName).toBe(merchant.displayName);
    expect(first.amountMinor).toBeNull();
    const payment = await qr.pay(first.payload, customer, 725);
    expect(payment.payeeId).toBe(merchant.owner.id);
    await expect(merchants.checkout(code.payload, customer, key)).rejects.toThrow(
      'no longer available',
    );
    const next = await merchants.checkout(code.payload, customer, randomUUID());
    expect(next.id).not.toBe(first.id);
    expect((await qr.resolve(next.payload, customer)).merchant?.id).toBe(merchant.id);
    expect(await database.client.payment.count({ where: { payeeId: merchant.owner.id } })).toBe(1);
  });
  it('rejects unsupported, hidden-owner and self static checkouts', async () => {
    const merchant = await shop();
    const code = await merchants.staticQr(merchant.id, merchant.owner.id);
    await expect(
      merchants.checkout('https://example.com', await participant(), randomUUID()),
    ).rejects.toThrow('unavailable');
    await expect(merchants.checkout(code.payload, merchant.owner.id, randomUUID())).rejects.toThrow(
      'different identity',
    );
    await database.client.user.update({
      where: { id: merchant.owner.id },
      data: { directoryListingEnabled: false },
    });
    await expect(
      merchants.checkout(code.payload, await participant(), randomUUID()),
    ).rejects.toThrow('unavailable');
  });
  it('keeps history limited to merchant-attributed requests and QR payments', async () => {
    const merchant = await shop();
    const customer = await participant();
    await requests.create({
      requesterId: merchant.owner.id,
      payerId: customer,
      amountMinor: 100,
      currency: 'EUR',
      idempotencyKey: randomUUID(),
    });
    await qr.create({ ownerId: merchant.owner.id, currency: 'EUR', idempotencyKey: randomUUID() });
    const code = await merchants.dynamicQr(
      merchant.id,
      merchant.owner.id,
      999,
      'EUR',
      randomUUID(),
    );
    const payment = await qr.pay(code.payload, customer, 999);
    await payments.authorizePayment(payment.id, {
      payerId: customer,
      decision: 'APPROVE',
      outcome: 'SUCCESS',
    });
    const history = await merchants.history(merchant.id, merchant.owner.id);
    expect(history.requests).toHaveLength(0);
    expect(history.codes).toHaveLength(1);
    expect(history.codes[0]?.payment?.state).toBe('SUCCEEDED');
    expect(JSON.stringify(history)).not.toMatch(
      /phoneNumber|providerReference|AccountId|idempotencyKey/,
    );
  });
  it('exposes an unavailable refund placeholder without creating financial records', async () => {
    const merchant = await shop();
    const profile = await merchants.get(merchant.id, merchant.owner.id);
    expect(profile.refunds.available).toBe(false);
    expect(profile.refunds.reason).toMatch(/no money/);
    expect(await database.client.payment.count({ where: { payeeId: merchant.owner.id } })).toBe(0);
  });
  it('marks unused merchant QR unavailable after recipient opt-out', async () => {
    const merchant = await shop();
    await merchants.dynamicQr(merchant.id, merchant.owner.id, 100, 'EUR', randomUUID());
    await database.client.user.update({
      where: { id: merchant.owner.id },
      data: { directoryListingEnabled: false },
    });
    expect((await merchants.history(merchant.id, merchant.owner.id)).codes[0]?.state).toBe(
      'UNAVAILABLE',
    );
  });
  it('rolls request attribution and request creation back together on audit failure', async () => {
    const merchant = await shop();
    const customer = await participant();
    const original = audit.append.bind(audit);
    vi.spyOn(audit, 'append').mockImplementation(async (event, transaction) => {
      if (event.type === 'MERCHANT_REQUEST_CREATED')
        throw new Error('Injected merchant audit failure');
      return original(event, transaction);
    });
    await expect(
      merchants.request(merchant.id, merchant.owner.id, customer, 100, 'EUR', randomUUID()),
    ).rejects.toThrow('Injected merchant audit failure');
    expect(
      await database.client.paymentRequest.count({ where: { requesterId: merchant.owner.id } }),
    ).toBe(0);
    expect(
      await database.client.merchantRequest.count({ where: { merchantId: merchant.id } }),
    ).toBe(0);
  });
  it('rolls dynamic QR creation back when merchant audit fails', async () => {
    const merchant = await shop();
    const original = audit.append.bind(audit);
    vi.spyOn(audit, 'append').mockImplementation(async (event, transaction) => {
      if (event.type === 'MERCHANT_QR_CREATED')
        throw new Error('Injected QR merchant audit failure');
      return original(event, transaction);
    });
    await expect(
      merchants.dynamicQr(merchant.id, merchant.owner.id, 100, 'EUR', randomUUID()),
    ).rejects.toThrow('Injected QR merchant audit failure');
    expect(
      await database.client.qrPaymentSession.count({ where: { merchantId: merchant.id } }),
    ).toBe(0);
  });
});

describe('merchant staff cancellation audit', () => {
  it('records the actual manager actor once on cancellation', async () => {
    const merchant = await shop();
    const manager = await participant();
    const customer = await participant();
    await merchants.member(merchant.id, merchant.owner.id, manager, 'MANAGER');
    const request = await merchants.request(
      merchant.id,
      manager,
      customer,
      100,
      'EUR',
      randomUUID(),
    );
    await merchants.cancelRequest(merchant.id, manager, request.id);
    await merchants.cancelRequest(merchant.id, manager, request.id);
    const events = await database.client.auditEventRecord.findMany({
      where: { entityId: merchant.id, eventType: 'MERCHANT_REQUEST_CANCELLED' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.metadata).toMatchObject({ actorId: manager, requestId: request.id });
  });
});

describe('merchant API boundaries', () => {
  it('guards all routes and rejects owner-role escalation and destination injection', async () => {
    expect(Reflect.getMetadata('__guards__', MerchantsController)).toContain(DevelopmentOnlyGuard);
    expect(
      await validate(
        plainToInstance(MerchantMemberDto, {
          userId: randomUUID(),
          memberId: randomUUID(),
          role: 'OWNER',
        }),
      ),
    ).toHaveLength(1);
    expect(
      await validate(
        plainToInstance(MerchantRequestDto, {
          userId: randomUUID(),
          payerId: randomUUID(),
          amountMinor: 100,
          currency: 'EUR',
          idempotencyKey: randomUUID(),
          payeeId: randomUUID(),
        }),
        { whitelist: true, forbidNonWhitelisted: true },
      ),
    ).toHaveLength(1);
    expect(
      await validate(
        plainToInstance(MerchantCheckoutDto, {
          payerId: randomUUID(),
          payload: `kliks:merchant:v1:${randomUUID()}`,
          idempotencyKey: randomUUID(),
        }),
      ),
    ).toEqual([]);
  });
});
