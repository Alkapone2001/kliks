import { randomInt } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseService } from '../src/database/database.service.js';
import { IdentityService } from '../src/modules/identity/identity.service.js';

const database = new DatabaseService();
const identityService = new IdentityService(database);
const createdUserIds: string[] = [];

async function createIdentity() {
  const suffix = randomInt(100000, 1000000).toString();
  const input = {
    phoneNumber: `044${suffix}`,
    username: `test_${suffix}`,
  };
  const identity = await identityService.createIdentity(input);
  createdUserIds.push(identity.id);
  return { input, identity };
}

beforeAll(async () => {
  await database.client.$connect();
});

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await database.client.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

afterAll(async () => {
  await database.onModuleDestroy();
});

describe('IdentityService', () => {
  it('persists normalized identity and returns no private phone number', async () => {
    const { identity } = await createIdentity();

    expect(identity.username).toMatch(/^test_\d{6}$/);
    expect(identity.phoneVerified).toBe(false);
    expect(identity).not.toHaveProperty('phoneNumber');

    const stored = await database.client.user.findUniqueOrThrow({
      where: { id: identity.id },
      select: { phoneNumber: true },
    });
    expect(stored.phoneNumber).toMatch(/^\+383\d+$/);
  });

  it('enforces unique normalized phone numbers and canonical usernames', async () => {
    const { input, identity } = await createIdentity();

    await expect(
      identityService.createIdentity({
        phoneNumber: '+383' + input.phoneNumber.slice(1),
        username: `other_${randomInt(100000, 1000000)}`,
      }),
    ).rejects.toThrow('Phone number or username is unavailable');

    await expect(
      identityService.createIdentity({
        phoneNumber: `044${randomInt(100000, 1000000)}`,
        username: identity.username.toUpperCase(),
      }),
    ).rejects.toThrow('Phone number or username is unavailable');
  });

  it('verifies a phone with a single-use development challenge and exposes no phone value', async () => {
    const { identity } = await createIdentity();
    const challenge = await identityService.startPhoneVerification(identity.id);

    expect(challenge.simulation).toBe(true);
    expect(challenge.developmentCode).toMatch(/^\d{6}$/);

    const storedChallenge = await database.client.phoneVerificationChallenge.findUniqueOrThrow({
      where: { id: challenge.challengeId },
      select: { codeHash: true },
    });
    expect(storedChallenge.codeHash).not.toBe(challenge.developmentCode);

    const verified = await identityService.confirmPhoneVerification(
      identity.id,
      challenge.challengeId,
      challenge.developmentCode,
    );
    expect(verified.phoneVerified).toBe(true);
    expect(verified).not.toHaveProperty('phoneNumber');

    await expect(
      identityService.confirmPhoneVerification(
        identity.id,
        challenge.challengeId,
        challenge.developmentCode,
      ),
    ).rejects.toThrow('invalid or expired');
  });

  it('rejects an incorrect or expired verification code', async () => {
    const { identity } = await createIdentity();
    const challenge = await identityService.startPhoneVerification(identity.id);
    const incorrectCode = challenge.developmentCode === '000000' ? '000001' : '000000';

    await expect(
      identityService.confirmPhoneVerification(identity.id, challenge.challengeId, incorrectCode),
    ).rejects.toThrow('invalid or expired');

    await database.client.phoneVerificationChallenge.update({
      where: { id: challenge.challengeId },
      data: { expiresAt: new Date(0) },
    });
    await expect(
      identityService.confirmPhoneVerification(
        identity.id,
        challenge.challengeId,
        challenge.developmentCode,
      ),
    ).rejects.toThrow('invalid or expired');
  });
});
