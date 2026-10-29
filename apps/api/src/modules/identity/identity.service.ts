import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@kliks/database';
import { DatabaseService } from '../../database/database.service.js';
import { KosovoPhoneNumber } from './domain/kosovo-phone-number.js';
import { Username } from './domain/username.js';

const scryptAsync = promisify(scrypt);
const verificationLifetimeMs = 5 * 60 * 1000;
const verificationCodeLength = 6;
const verificationHashBytes = 32;

export interface CreateIdentityInput {
  phoneNumber: string;
  username: string;
}

export interface PublicIdentity {
  id: string;
  username: string;
  phoneVerified: boolean;
  createdAt: Date;
}

export interface DevelopmentVerificationChallenge {
  challengeId: string;
  developmentCode: string;
  expiresAt: Date;
  simulation: true;
}

@Injectable()
export class IdentityService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async createIdentity(input: CreateIdentityInput): Promise<PublicIdentity> {
    let phoneNumber: KosovoPhoneNumber;
    let username: Username;
    try {
      phoneNumber = KosovoPhoneNumber.parse(input.phoneNumber);
      username = Username.parse(input.username);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    try {
      const user = await this.database.client.user.create({
        data: { phoneNumber: phoneNumber.e164, username: username.value },
        select: { id: true, username: true, phoneVerifiedAt: true, createdAt: true },
      });
      return this.toPublicIdentity(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Phone number or username is unavailable.');
      }
      throw error;
    }
  }

  async startPhoneVerification(userId: string): Promise<DevelopmentVerificationChallenge> {
    const user = await this.database.client.user.findUnique({
      where: { id: userId },
      select: { id: true, phoneVerifiedAt: true },
    });
    if (!user) {
      throw new NotFoundException('Identity not found.');
    }
    if (user.phoneVerifiedAt) {
      throw new ConflictException('Phone number is already verified.');
    }

    const developmentCode = randomInt(0, 10 ** verificationCodeLength)
      .toString()
      .padStart(verificationCodeLength, '0');
    const salt = randomBytes(16).toString('hex');
    const codeHash = await this.hashCode(developmentCode, salt);
    const expiresAt = new Date(Date.now() + verificationLifetimeMs);
    const challenge = await this.database.client.$transaction(async (transaction) => {
      await transaction.phoneVerificationChallenge.deleteMany({ where: { userId } });
      return transaction.phoneVerificationChallenge.create({
        data: { userId, codeHash, salt, expiresAt },
        select: { id: true, expiresAt: true },
      });
    });

    return {
      challengeId: challenge.id,
      developmentCode,
      expiresAt: challenge.expiresAt,
      simulation: true,
    };
  }

  async confirmPhoneVerification(
    userId: string,
    challengeId: string,
    code: string,
  ): Promise<PublicIdentity> {
    const invalidCode = new BadRequestException('Verification code is invalid or expired.');
    const challenge = await this.database.client.phoneVerificationChallenge.findFirst({
      where: { id: challengeId, userId, consumedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, codeHash: true, salt: true },
    });
    if (!challenge || !/^\d{6}$/.test(code)) {
      throw invalidCode;
    }

    const expectedHash = Buffer.from(challenge.codeHash, 'hex');
    const actualHash = Buffer.from(await this.hashCode(code, challenge.salt), 'hex');
    if (expectedHash.length !== actualHash.length || !timingSafeEqual(expectedHash, actualHash)) {
      throw invalidCode;
    }

    const now = new Date();
    return this.database.client.$transaction(async (transaction) => {
      const consumed = await transaction.phoneVerificationChallenge.updateMany({
        where: { id: challengeId, userId, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        throw invalidCode;
      }

      const user = await transaction.user.update({
        where: { id: userId },
        data: { phoneVerifiedAt: now },
        select: { id: true, username: true, phoneVerifiedAt: true, createdAt: true },
      });
      return this.toPublicIdentity(user);
    });
  }

  private async hashCode(code: string, salt: string): Promise<string> {
    const key = await scryptAsync(code, salt, verificationHashBytes);
    return (key as Buffer).toString('hex');
  }

  private toPublicIdentity(user: {
    id: string;
    username: string;
    phoneVerifiedAt: Date | null;
    createdAt: Date;
  }): PublicIdentity {
    return {
      id: user.id,
      username: user.username,
      phoneVerified: user.phoneVerifiedAt !== null,
      createdAt: user.createdAt,
    };
  }
}
