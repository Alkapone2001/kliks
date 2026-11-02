import 'reflect-metadata';
import { randomInt, randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseService } from '../src/database/database.service.js';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { MockBankConnector } from '../src/modules/banking/mock-bank-connector.js';
import { BankingService } from '../src/modules/banking/banking.service.js';
import { DirectoryService } from '../src/modules/directory/directory.service.js';
import { PaymentsService } from '../src/modules/payments/payments.service.js';
import { PaymentRequestsService } from '../src/modules/payment-requests/payment-requests.service.js';
import { SplitBillsService } from '../src/modules/split-bills/split-bills.service.js';
import { QrPaymentsService } from '../src/modules/qr-payments/qr-payments.service.js';
import { MerchantsService } from '../src/modules/merchants/merchants.service.js';
import { AdminService } from '../src/modules/admin/admin.service.js';

const database = new DatabaseService();
const audit = new AuditService(database);
const connector = new MockBankConnector();
const banking = new BankingService(database, connector, audit);
const payments = new PaymentsService(database, connector, audit);
const requests = new PaymentRequestsService(database, payments, audit);
const directory = new DirectoryService(database, audit);
const bills = new SplitBillsService(database, requests, audit);
const qr = new QrPaymentsService(database, payments, audit);
const merchants = new MerchantsService(database, requests, qr, audit);
const admin = new AdminService(database, banking, directory, requests, bills, merchants, audit);
const userIds: string[] = [];

async function user(verified = true, prefix = 'admin_test') {
  const created = await database.client.user.create({
    data: {
      phoneNumber: `+38343${randomInt(100000, 1000000)}`,
      username: `${prefix}_${randomUUID().slice(0, 8)}`,
      phoneVerifiedAt: verified ? new Date() : null,
    },
  });
  userIds.push(created.id);
  return created;
}
beforeAll(async () => {
  await database.client.$connect();
});
afterEach(async () => {
  const accounts = await database.client.linkedBankAccount.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  await database.client.auditEventRecord.deleteMany({
    where: { entityId: { in: [...userIds, ...accounts.map((entry) => entry.id)] } },
  });
  await database.client.linkedBankAccount.deleteMany({ where: { userId: { in: userIds } } });
  await database.client.user.deleteMany({ where: { id: { in: userIds } } });
  userIds.length = 0;
});
afterAll(async () => {
  await database.onModuleDestroy();
});

describe('safe demo administration', () => {
  it('paginates server users independently of browser storage and hides sensitive fields', async () => {
    const prefix = 'page_' + randomUUID().slice(0, 6);
    for (let index = 0; index < 27; index++) await user(true, prefix);
    const first = await admin.records({ kind: 'users', q: prefix });
    expect(first.items).toHaveLength(25);
    expect(first.nextCursor).toBeTruthy();
    const second = await admin.records({
      kind: 'users',
      q: prefix,
      cursor: first.nextCursor ?? '',
    });
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((entry) => entry.id)).size).toBe(27);
    expect(JSON.stringify(first)).not.toMatch(
      /phoneNumber|codeHash|providerAccountReference|DEMO_ADMIN_TOKEN/,
    );
  });
  it('uses existing validation for visibility and accounts and records admin intent/outcome', async () => {
    const identity = await user();
    await admin.action({ action: 'directory', id: identity.id, enabled: true });
    await admin.action({ action: 'connect-account', id: identity.id });
    const accounts = await admin.records({ kind: 'accounts', q: identity.username });
    const account = accounts.items[0];
    if (!account) throw new Error('Missing test account');
    await admin.action({ action: 'approve-account', id: account.id });
    await admin.action({ action: 'default-account', id: account.id });
    const stored = await database.client.linkedBankAccount.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(stored.isDefault).toBe(true);
    const events = await database.client.auditEventRecord.findMany({
      where: { entityId: account.id, eventType: 'ADMIN_ACTION_COMPLETED' },
    });
    expect(events).toHaveLength(2);
    expect(events[0]?.metadata).toMatchObject({ actor: 'demo-admin', simulation: true });
  });
  it('rejects invalid management and offers no forced payment or audit mutation', async () => {
    const identity = await user(false);
    await expect(
      admin.action({ action: 'directory', id: identity.id, enabled: true }),
    ).rejects.toThrow('Verify');
    expect(
      await database.client.auditEventRecord.count({
        where: { entityId: identity.id, eventType: 'ADMIN_ACTION_FAILED' },
      }),
    ).toBe(1);
    expect(
      (await admin.records({ kind: 'users', q: identity.username })).items[0]?.actions,
    ).toEqual([]);
    expect(
      (await admin.records({ kind: 'payments' })).items.every(
        (entry) => entry.actions.length === 0,
      ),
    ).toBe(true);
    expect(
      (await admin.records({ kind: 'audit' })).items.every((entry) => entry.actions.length === 0),
    ).toBe(true);
  });
  it('reports server record counts without account or credential data', async () => {
    await user();
    const result = await admin.overview();
    expect(result.counts.users).toBeGreaterThanOrEqual(1);
    expect(result.simulation).toBe(true);
    expect(result.persistence).toContain('PostgreSQL');
  });
});
