import { randomInt } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseService } from '../src/database/database.service.js';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { DirectoryService } from '../src/modules/directory/directory.service.js';
import { IdentityService } from '../src/modules/identity/identity.service.js';

const database = new DatabaseService();
const auditService = new AuditService(database);
const identityService = new IdentityService(database);
const directoryService = new DirectoryService(database, auditService);
const createdUserIds: string[] = [];
const createdAccountIds: string[] = [];

async function createIdentity(verified = true) {
  const suffix = randomInt(100000, 1000000).toString();
  const identity = await identityService.createIdentity({
    phoneNumber: `044${suffix}`,
    username: `directory_${suffix}`,
  });
  createdUserIds.push(identity.id);
  if (verified) {
    await database.client.user.update({
      where: { id: identity.id },
      data: { phoneVerifiedAt: new Date() },
    });
  }
  return {
    id: identity.id,
    phoneNumber: `044${suffix}`,
    username: identity.username,
  };
}

beforeAll(async () => {
  await database.client.$connect();
});

afterEach(async () => {
  if (createdAccountIds.length > 0) {
    await database.client.linkedBankAccount.deleteMany({
      where: { id: { in: createdAccountIds } },
    });
    createdAccountIds.length = 0;
  }
  if (createdUserIds.length > 0) {
    await database.client.auditEventRecord.deleteMany({
      where: { entityId: { in: createdUserIds } },
    });
    await database.client.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

afterAll(async () => {
  await database.onModuleDestroy();
});

describe('DirectoryService', () => {
  it('keeps new identities private until explicitly opted in', async () => {
    const identity = await createIdentity();
    const stored = await database.client.user.findUniqueOrThrow({
      where: { id: identity.id },
      select: { directoryListingEnabled: true },
    });

    expect(stored.directoryListingEnabled).toBe(false);
    await expect(
      database.client.auditEventRecord.findMany({ where: { entityId: identity.id } }),
    ).resolves.toEqual([]);
    await expect(directoryService.resolveByPhone(identity.phoneNumber)).rejects.toThrow(
      'Recipient not found.',
    );
    await expect(directoryService.resolveByUsername(identity.username)).rejects.toThrow(
      'Recipient not found.',
    );
  });

  it('requires phone verification before enabling directory visibility', async () => {
    const identity = await createIdentity(false);

    await expect(directoryService.setVisibility(identity.id, true)).rejects.toThrow(
      'Verify the phone number before enabling directory visibility',
    );
    await expect(directoryService.setVisibility(identity.id, false)).resolves.toEqual({
      enabled: false,
    });
  });

  it('resolves opted-in recipients by normalized phone and canonical username only', async () => {
    const identity = await createIdentity();
    await directoryService.setVisibility(identity.id, true);

    const bankAccount = await database.client.linkedBankAccount.create({
      data: {
        userId: identity.id,
        connectorId: 'mock-bank',
        providerAccountReference: `mock_private_${identity.id}`,
        displayName: 'Mock Bank Demo Account',
        connectionStatus: 'CONNECTED',
      },
      select: { id: true },
    });
    createdAccountIds.push(bankAccount.id);

    const byNationalPhone = await directoryService.resolveByPhone(identity.phoneNumber);
    const byInternationalPhone = await directoryService.resolveByPhone(
      `+383${identity.phoneNumber.slice(1)}`,
    );
    const byUsername = await directoryService.resolveByUsername(identity.username.toUpperCase());

    expect(byNationalPhone).toEqual(byInternationalPhone);
    expect(byUsername.id).toBe(identity.id);
    expect(byUsername).toMatchObject({
      id: identity.id,
      username: identity.username,
      phoneVerified: true,
    });
    expect(byUsername).not.toHaveProperty('phoneNumber');
    expect(byUsername).not.toHaveProperty('linkedBankAccounts');
    expect(byUsername).not.toHaveProperty('providerAccountReference');
  });

  it('returns the same not-found response for unknown, unlisted, and malformed lookups', async () => {
    const unlisted = await createIdentity();
    const unknownPhone = `044${randomInt(100000, 1000000)}`;
    const unknownUsername = `missing_${randomInt(100000, 1000000)}`;
    const failures: Error[] = [];

    for (const resolve of [
      () => directoryService.resolveByPhone(unlisted.phoneNumber),
      () => directoryService.resolveByPhone(unknownPhone),
      () => directoryService.resolveByPhone('invalid-phone'),
      () => directoryService.resolveByUsername(unlisted.username),
      () => directoryService.resolveByUsername(unknownUsername),
      () => directoryService.resolveByUsername('not valid'),
    ]) {
      try {
        await resolve();
        throw new Error('Expected recipient resolution to fail.');
      } catch (error) {
        failures.push(error as Error);
      }
    }

    expect(failures.map((error) => error.constructor)).toEqual(
      failures.map(() => failures[0]?.constructor),
    );
    expect(failures.map((error) => error.message)).toEqual(
      failures.map(() => 'Recipient not found.'),
    );
  });

  it('removes an opted-in recipient from search when they opt out', async () => {
    const identity = await createIdentity();
    await directoryService.setVisibility(identity.id, true);
    await expect(directoryService.resolveByUsername(identity.username)).resolves.toMatchObject({
      id: identity.id,
    });

    await expect(directoryService.setVisibility(identity.id, false)).resolves.toEqual({
      enabled: false,
    });
    await expect(directoryService.resolveByUsername(identity.username)).rejects.toThrow(
      'Recipient not found.',
    );

    const events = await database.client.auditEventRecord.findMany({
      where: { entityId: identity.id },
      orderBy: { occurredAt: 'asc' },
      select: { eventType: true, metadata: true },
    });
    expect(events.map((event) => event.eventType)).toEqual([
      'DIRECTORY_VISIBILITY_ENABLED',
      'DIRECTORY_VISIBILITY_DISABLED',
    ]);
    expect(events.map((event) => event.metadata)).toEqual([{ enabled: true }, { enabled: false }]);
  });
});
