import { randomInt } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseService } from '../src/database/database.service.js';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { BankingService } from '../src/modules/banking/banking.service.js';
import { MockBankConnector } from '../src/modules/banking/mock-bank-connector.js';
import { IdentityService } from '../src/modules/identity/identity.service.js';

const database = new DatabaseService();
const identityService = new IdentityService(database);
const auditService = new AuditService(database);
const bankingService = new BankingService(database, new MockBankConnector(), auditService);
const createdUserIds: string[] = [];
const createdAccountIds: string[] = [];

async function createIdentity(verified = true): Promise<string> {
  const suffix = randomInt(100000, 1000000).toString();
  const identity = await identityService.createIdentity({
    phoneNumber: `044${suffix}`,
    username: `bank_test_${suffix}`,
  });
  createdUserIds.push(identity.id);
  if (verified) {
    await database.client.user.update({
      where: { id: identity.id },
      data: { phoneVerifiedAt: new Date() },
    });
  }
  return identity.id;
}

async function connectAccount(userId: string) {
  const account = await bankingService.connectAccount(userId);
  createdAccountIds.push(account.id);
  return account;
}

beforeAll(async () => {
  await database.client.$connect();
});

afterEach(async () => {
  if (createdAccountIds.length > 0) {
    await database.client.auditEventRecord.deleteMany({
      where: { entityId: { in: createdAccountIds } },
    });
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

describe('BankingService', () => {
  it('requires a verified identity and starts a visibly simulated connection', async () => {
    const unverifiedUserId = await createIdentity(false);
    await expect(bankingService.connectAccount(unverifiedUserId)).rejects.toThrow(
      'Verify the phone number before connecting an account',
    );

    const userId = await createIdentity();
    const account = await connectAccount(userId);

    expect(account).toMatchObject({
      connectorId: 'mock-bank',
      displayName: 'Mock Bank Demo Account',
      status: 'PENDING_AUTHORIZATION',
      isDefault: false,
      simulation: true,
    });
    expect(account).not.toHaveProperty('providerAccountReference');

    const audit = await database.client.auditEventRecord.findFirstOrThrow({
      where: { entityId: account.id },
      select: { eventType: true, metadata: true },
    });
    expect(audit.eventType).toBe('BANK_CONNECTION_STARTED');
    expect(audit.metadata).toMatchObject({ connectorId: 'mock-bank', simulation: true });
  });

  it('approves, switches default, and disconnects while preserving audit history', async () => {
    const userId = await createIdentity();
    const first = await connectAccount(userId);
    const connectedFirst = await bankingService.authorizeAccount(userId, first.id, 'APPROVE');
    expect(connectedFirst.status).toBe('CONNECTED');

    const defaultFirst = await bankingService.setDefaultAccount(userId, first.id);
    expect(defaultFirst.isDefault).toBe(true);

    const second = await connectAccount(userId);
    await bankingService.authorizeAccount(userId, second.id, 'APPROVE');
    const defaultSecond = await bankingService.setDefaultAccount(userId, second.id);
    expect(defaultSecond.isDefault).toBe(true);

    const accounts = await bankingService.listAccounts(userId);
    expect(accounts.filter((account) => account.isDefault).map((account) => account.id)).toEqual([
      second.id,
    ]);

    const disconnected = await bankingService.disconnectAccount(userId, second.id);
    expect(disconnected).toMatchObject({
      status: 'DISCONNECTED',
      isDefault: false,
      simulation: true,
    });

    const eventTypes = await database.client.auditEventRecord.findMany({
      where: { entityId: second.id },
      orderBy: { occurredAt: 'asc' },
      select: { eventType: true },
    });
    expect(eventTypes.map((event) => event.eventType)).toEqual([
      'BANK_CONNECTION_STARTED',
      'BANK_CONNECTION_SUCCEEDED',
      'BANK_ACCOUNT_DEFAULT_CHANGED',
      'BANK_CONNECTION_DISCONNECTED',
    ]);
  });

  it('rejects authorization, invalid transitions, and cross-user account access', async () => {
    const ownerId = await createIdentity();
    const otherUserId = await createIdentity();
    const account = await connectAccount(ownerId);

    const rejected = await bankingService.authorizeAccount(ownerId, account.id, 'REJECT');
    expect(rejected.status).toBe('REJECTED');
    await expect(bankingService.authorizeAccount(ownerId, account.id, 'APPROVE')).rejects.toThrow(
      'not awaiting authorization',
    );
    await expect(bankingService.setDefaultAccount(ownerId, account.id)).rejects.toThrow(
      'Only connected accounts',
    );
    await expect(bankingService.disconnectAccount(otherUserId, account.id)).rejects.toThrow(
      'Linked account not found',
    );
    await expect(bankingService.listAccounts(otherUserId)).resolves.toEqual([]);
  });
});
