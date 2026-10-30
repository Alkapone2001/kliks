import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@kliks/database';
import { parseMerchantQrPayload } from '@kliks/shared';
import QRCode from 'qrcode';
import { DatabaseService } from '../../database/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditEventType } from '../audit/audit-event.js';
import { PaymentRequestsService } from '../payment-requests/payment-requests.service.js';
import { QrPaymentsService } from '../qr-payments/qr-payments.service.js';

const profileSelect = {
  id: true,
  ownerId: true,
  displayName: true,
  createdAt: true,
  owner: {
    select: {
      id: true,
      username: true,
      createdAt: true,
      phoneVerifiedAt: true,
      directoryListingEnabled: true,
    },
  },
  members: { select: { userId: true, role: true, user: { select: { id: true, username: true } } } },
} satisfies Prisma.MerchantProfileSelect;
type Profile = Prisma.MerchantProfileGetPayload<{ select: typeof profileSelect }>;

@Injectable()
export class MerchantsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(PaymentRequestsService) private readonly requests: PaymentRequestsService,
    @Inject(QrPaymentsService) private readonly qr: QrPaymentsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(userId: string, displayName: string) {
    const name = this.name(displayName);
    return this.database.client.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`,
      );
      const owner = await transaction.user.findUnique({
        where: { id: userId },
        select: { phoneVerifiedAt: true, directoryListingEnabled: true },
      });
      if (!owner?.phoneVerifiedAt || !owner.directoryListingEnabled)
        throw new ConflictException(
          'Verify your identity and enable recipient discovery before creating a merchant.',
        );
      const existing = await transaction.merchantProfile.findUnique({
        where: { ownerId: userId },
        select: profileSelect,
      });
      if (existing) {
        if (existing.displayName !== name)
          throw new ConflictException(
            'A merchant profile already exists; edit its profile instead.',
          );
        return this.toPublic(existing, userId);
      }
      const profile = await transaction.merchantProfile.create({
        data: { ownerId: userId, displayName: name },
        select: profileSelect,
      });
      await this.record(transaction, 'MERCHANT_CREATED', profile.id, userId);
      return this.toPublic(profile, userId);
    });
  }

  async list(userId: string) {
    if (
      !(await this.database.client.user.findUnique({ where: { id: userId }, select: { id: true } }))
    )
      throw new NotFoundException('Identity not found.');
    const profiles = await this.database.client.merchantProfile.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      orderBy: { createdAt: 'desc' },
      select: profileSelect,
    });
    return profiles.map((profile) => this.toPublic(profile, userId));
  }

  async get(id: string, userId: string) {
    return this.toPublic(await this.access(this.database.client, id, userId), userId);
  }

  async update(id: string, userId: string, displayName: string) {
    const name = this.name(displayName);
    return this.database.client.$transaction(async (transaction) => {
      const profile = await this.access(transaction, id, userId, 'owner');
      if (profile.displayName === name) return this.toPublic(profile, userId);
      const updated = await transaction.merchantProfile.update({
        where: { id },
        data: { displayName: name },
        select: profileSelect,
      });
      await this.record(transaction, 'MERCHANT_PROFILE_UPDATED', id, userId);
      return this.toPublic(updated, userId);
    });
  }

  async member(
    id: string,
    userId: string,
    memberId: string,
    role: 'MANAGER' | 'VIEWER' | 'REMOVE',
  ) {
    if (!['MANAGER', 'VIEWER', 'REMOVE'].includes(role))
      throw new BadRequestException('Choose a manager or viewer role.');
    return this.database.client.$transaction(async (transaction) => {
      const profile = await this.access(transaction, id, userId, 'owner');
      if (memberId === profile.ownerId)
        throw new BadRequestException('The owner role cannot be changed or removed.');
      const existing = profile.members.find((entry) => entry.userId === memberId);
      if (role === 'REMOVE') {
        if (existing)
          await transaction.merchantMembership.delete({
            where: { merchantId_userId: { merchantId: id, userId: memberId } },
          });
      } else {
        const member = await transaction.user.findUnique({
          where: { id: memberId },
          select: { phoneVerifiedAt: true },
        });
        if (!member?.phoneVerifiedAt)
          throw new NotFoundException('Verified staff identity not found.');
        await transaction.merchantMembership.upsert({
          where: { merchantId_userId: { merchantId: id, userId: memberId } },
          create: { merchantId: id, userId: memberId, role },
          update: { role },
        });
      }
      if ((role === 'REMOVE' && existing) || (role !== 'REMOVE' && existing?.role !== role))
        await this.record(transaction, 'MERCHANT_ROLE_CHANGED', id, userId, {
          memberId,
          role,
          previousRole: existing?.role ?? null,
        });
      return this.toPublic(
        await transaction.merchantProfile.findUniqueOrThrow({
          where: { id },
          select: profileSelect,
        }),
        userId,
      );
    });
  }

  async request(
    id: string,
    userId: string,
    payerId: string,
    amountMinor: number,
    currency: string,
    key: string,
  ) {
    return this.database.client.$transaction(
      async (transaction) => {
        const profile = await this.access(transaction, id, userId, 'write');
        const created = await this.requests.create(
          {
            requesterId: profile.ownerId,
            payerId,
            amountMinor,
            currency,
            idempotencyKey: this.key(id, key, 'request'),
          },
          transaction,
        );
        const existing = await transaction.merchantRequest.findUnique({
          where: { requestId: created.id },
        });
        if (!existing) {
          await transaction.merchantRequest.create({
            data: { merchantId: id, requestId: created.id, createdById: userId },
          });
          await this.record(transaction, 'MERCHANT_REQUEST_CREATED', id, userId, {
            requestId: created.id,
          });
        } else if (existing.merchantId !== id)
          throw new ConflictException('Request already belongs to another merchant.');
        return { ...created, merchant: { id: profile.id, displayName: profile.displayName } };
      },
      { timeout: 15000 },
    );
  }

  async cancelRequest(id: string, userId: string, requestId: string) {
    return this.database.client.$transaction(async (transaction) => {
      const profile = await this.access(transaction, id, userId, 'write');
      const linked = await transaction.merchantRequest.findFirst({
        where: { merchantId: id, requestId },
        select: { id: true, request: { select: { state: true } } },
      });
      if (!linked) throw new NotFoundException('Merchant request not found.');
      const cancelled = await this.requests.cancel(requestId, profile.ownerId, transaction);
      if (linked.request.state === 'PENDING')
        await this.record(transaction, 'MERCHANT_REQUEST_CANCELLED', id, userId, { requestId });
      return cancelled;
    });
  }

  async dynamicQr(id: string, userId: string, amountMinor: number, currency: string, key: string) {
    return this.database.client.$transaction(
      async (transaction) => {
        const profile = await this.access(transaction, id, userId, 'write');
        const idempotencyKey = this.key(id, key, 'qr');
        const previous = await transaction.qrPaymentSession.findUnique({
          where: { ownerId_idempotencyKey: { ownerId: profile.ownerId, idempotencyKey } },
          select: { id: true },
        });
        const code = await this.qr.create(
          { ownerId: profile.ownerId, merchantId: id, amountMinor, currency, idempotencyKey },
          transaction,
        );
        if (!previous)
          await this.record(transaction, 'MERCHANT_QR_CREATED', id, userId, { sessionId: code.id });
        return code;
      },
      { timeout: 15000 },
    );
  }

  async staticQr(id: string, userId: string) {
    const profile = await this.access(this.database.client, id, userId);
    const payload = `kliks:merchant:v1:${profile.id}`;
    return {
      merchant: { id: profile.id, displayName: profile.displayName },
      payload,
      imageDataUrl: await QRCode.toDataURL(payload, {
        width: 320,
        margin: 4,
        errorCorrectionLevel: 'M',
      }),
      simulation: true as const,
    };
  }

  async checkout(payload: string, payerId: string, key: string) {
    const id = parseMerchantQrPayload(payload);
    if (!id) throw new NotFoundException('Merchant QR is unavailable.');
    return this.database.client.$transaction(
      async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "merchant_profiles" WHERE "id" = ${id}::uuid FOR UPDATE`,
        );
        const profile = await transaction.merchantProfile.findUnique({
          where: { id },
          select: profileSelect,
        });
        if (!profile || !profile.owner.phoneVerifiedAt || !profile.owner.directoryListingEnabled)
          throw new NotFoundException('Merchant QR is unavailable.');
        if (profile.ownerId === payerId)
          throw new BadRequestException('Choose a merchant owned by a different identity.');
        const payer = await transaction.user.findUnique({
          where: { id: payerId },
          select: { phoneVerifiedAt: true },
        });
        if (!payer?.phoneVerifiedAt)
          throw new ConflictException('Payer identity must have a verified phone number.');
        const session = await this.qr.create(
          {
            ownerId: profile.ownerId,
            merchantId: id,
            currency: 'EUR',
            idempotencyKey: this.key(id, key, `checkout-${payerId}`),
          },
          transaction,
        );
        if (session.state !== 'AVAILABLE')
          throw new ConflictException(
            'Checkout is no longer available. Scan the static QR again for a new checkout.',
          );
        return {
          id: session.id,
          payload: session.payload,
          merchant: { id: profile.id, displayName: profile.displayName },
          recipient: {
            id: profile.owner.id,
            username: profile.owner.username,
            createdAt: profile.owner.createdAt,
            phoneVerified: true as const,
          },
          amountMinor: null,
          currency: 'EUR' as const,
          expiresAt: session.expiresAt,
          simulation: true as const,
        };
      },
      { timeout: 15000 },
    );
  }

  async history(id: string, userId: string) {
    const profile = await this.access(this.database.client, id, userId);
    const requestRows = await this.database.client.merchantRequest.findMany({
      where: { merchantId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        createdAt: true,
        createdBy: { select: { id: true, username: true } },
        request: {
          select: {
            id: true,
            amountMinor: true,
            state: true,
            payer: { select: { id: true, username: true } },
            payment: { select: { id: true, state: true, failureCode: true } },
          },
        },
      },
    });
    const sessions = await this.database.client.qrPaymentSession.findMany({
      where: { merchantId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        amountMinor: true,
        expiresAt: true,
        consumedAt: true,
        createdAt: true,
        payment: {
          select: {
            id: true,
            amountMinor: true,
            state: true,
            failureCode: true,
            payer: { select: { id: true, username: true } },
          },
        },
      },
    });
    return {
      requests: requestRows.map((entry) => ({
        ...entry.request,
        amountMinor: Number(entry.request.amountMinor),
        createdBy: entry.createdBy,
        createdAt: entry.createdAt,
        simulation: true as const,
      })),
      codes: sessions.map((entry) => ({
        id: entry.id,
        amountMinor: entry.amountMinor === null ? null : Number(entry.amountMinor),
        state: entry.consumedAt
          ? 'USED'
          : entry.expiresAt.getTime() <= Date.now()
            ? 'EXPIRED'
            : !profile.owner.phoneVerifiedAt || !profile.owner.directoryListingEnabled
              ? 'UNAVAILABLE'
              : 'AVAILABLE',
        expiresAt: entry.expiresAt,
        createdAt: entry.createdAt,
        payment: entry.payment
          ? { ...entry.payment, amountMinor: Number(entry.payment.amountMinor) }
          : null,
        simulation: true as const,
      })),
      simulation: true as const,
    };
  }

  private async access(
    client: Prisma.TransactionClient,
    id: string,
    userId: string,
    mode: 'read' | 'write' | 'owner' = 'read',
  ) {
    if (mode !== 'read')
      await client.$queryRaw(
        Prisma.sql`SELECT "id" FROM "merchant_profiles" WHERE "id" = ${id}::uuid FOR UPDATE`,
      );
    const profile = await client.merchantProfile.findFirst({
      where: { id, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      select: profileSelect,
    });
    if (!profile) throw new NotFoundException('Merchant not found.');
    const role =
      profile.ownerId === userId
        ? 'OWNER'
        : profile.members.find((entry) => entry.userId === userId)?.role;
    if ((mode === 'owner' && role !== 'OWNER') || (mode === 'write' && role === 'VIEWER'))
      throw new ForbiddenException('Your merchant role does not allow this action.');
    return profile;
  }

  private toPublic(profile: Profile, userId: string) {
    return {
      id: profile.id,
      displayName: profile.displayName,
      owner: { id: profile.owner.id, username: profile.owner.username },
      role:
        profile.ownerId === userId
          ? ('OWNER' as const)
          : profile.members.find((entry) => entry.userId === userId)!.role,
      members: profile.members.map((entry) => ({ user: entry.user, role: entry.role })),
      createdAt: profile.createdAt,
      refunds: {
        available: false as const,
        reason:
          'Refunds are unavailable: simulations move no money, and real provider reversal/dispute rules are not established.',
      },
      simulation: true as const,
    };
  }
  private name(value: string) {
    const result = value.trim();
    if (!result || result.length > 80)
      throw new BadRequestException('Enter a merchant name of 1 to 80 characters.');
    return result;
  }
  private key(id: string, value: string, scope: string) {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(value))
      throw new BadRequestException('Use an idempotency key of 8 to 128 safe characters.');
    return `merchant-${createHash('sha256')
      .update(JSON.stringify([id, scope, value]))
      .digest('hex')}`;
  }
  private async record(
    transaction: Prisma.TransactionClient,
    type: AuditEventType,
    entityId: string,
    actorId: string,
    metadata: Readonly<Record<string, string | boolean | null>> = {},
  ) {
    await this.audit.append(
      {
        eventId: randomUUID(),
        type,
        entityId,
        occurredAt: new Date(),
        metadata: { actorId, simulation: true, ...metadata },
      },
      transaction,
    );
  }
}
