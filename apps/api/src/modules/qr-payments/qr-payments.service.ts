import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@kliks/database';
import { Money, parseQrPaymentPayload } from '@kliks/shared';
import QRCode from 'qrcode';
import { DatabaseService } from '../../database/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditEventType } from '../audit/audit-event.js';
import { PaymentsService } from '../payments/payments.service.js';

interface CreateQrInput {
  ownerId: string;
  amountMinor?: number | null;
  currency: string;
  idempotencyKey: string;
}
const qrSelect = {
  id: true,
  ownerId: true,
  amountMinor: true,
  currency: true,
  idempotencyKey: true,
  expiresAt: true,
  consumedAt: true,
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
  payment: {
    select: {
      id: true,
      payerId: true,
      payeeId: true,
      amountMinor: true,
      currency: true,
      state: true,
      failureCode: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.QrPaymentSessionSelect;
type StoredQr = Prisma.QrPaymentSessionGetPayload<{ select: typeof qrSelect }>;

@Injectable()
export class QrPaymentsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(input: CreateQrInput) {
    const amountMinor = input.amountMinor ?? null;
    this.validateAmount(amountMinor ?? 1, input.currency);
    const key = input.idempotencyKey.trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key))
      throw new BadRequestException('Idempotency key must be 8 to 128 safe characters.');
    const where = { ownerId_idempotencyKey: { ownerId: input.ownerId, idempotencyKey: key } };
    const existing = await this.database.client.qrPaymentSession.findUnique({
      where,
      select: qrSelect,
    });
    if (existing) return this.retryCode(existing, amountMinor, input.currency);
    try {
      const session = await this.database.client.$transaction(async (transaction) => {
        const owner = await transaction.user.findUnique({
          where: { id: input.ownerId },
          select: { phoneVerifiedAt: true, directoryListingEnabled: true },
        });
        if (!owner?.phoneVerifiedAt || !owner.directoryListingEnabled)
          throw new ConflictException(
            'Verify your identity and enable recipient discovery before creating a QR code.',
          );
        const createdAt = new Date();
        const created = await transaction.qrPaymentSession.create({
          data: {
            ownerId: input.ownerId,
            amountMinor: amountMinor === null ? null : BigInt(amountMinor),
            currency: input.currency,
            idempotencyKey: key,
            createdAt,
            expiresAt: new Date(createdAt.getTime() + 15 * 60 * 1000),
          },
          select: qrSelect,
        });
        await this.record(transaction, 'QR_PAYMENT_CREATED', created.id, input.ownerId);
        return created;
      });
      return this.toCode(session);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await this.database.client.qrPaymentSession.findUnique({
          where,
          select: qrSelect,
        });
        if (duplicate) return this.retryCode(duplicate, amountMinor, input.currency);
      }
      throw error;
    }
  }

  async list(userId: string) {
    if (
      !(await this.database.client.user.findUnique({ where: { id: userId }, select: { id: true } }))
    )
      throw new NotFoundException('Identity not found.');
    const sessions = await this.database.client.qrPaymentSession.findMany({
      where: { ownerId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: qrSelect,
    });
    return sessions.map((session) => this.summary(session));
  }

  async get(sessionId: string, userId: string) {
    const session = await this.database.client.qrPaymentSession.findFirst({
      where: { id: sessionId, ownerId: userId },
      select: qrSelect,
    });
    if (!session) throw new NotFoundException('QR code is unavailable.');
    return this.toCode(session);
  }

  async resolve(payload: string, payerId: string) {
    const id = this.sessionId(payload);
    const session = await this.database.client.qrPaymentSession.findUnique({
      where: { id },
      select: qrSelect,
    });
    this.requireAvailable(session);
    if (session.ownerId === payerId)
      throw new BadRequestException('Choose a QR code from a different recipient.');
    await this.requirePayer(this.database.client, payerId);
    return {
      id: session.id,
      recipient: {
        id: session.owner.id,
        username: session.owner.username,
        createdAt: session.owner.createdAt,
        phoneVerified: true as const,
      },
      amountMinor: session.amountMinor === null ? null : Number(session.amountMinor),
      currency: session.currency,
      expiresAt: session.expiresAt,
      simulation: true as const,
    };
  }

  async pay(payload: string, payerId: string, amountMinor: number) {
    const id = this.sessionId(payload);
    this.validateAmount(amountMinor, 'EUR');
    return this.database.client.$transaction(
      async (transaction) => {
        const rows = await transaction.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT "id" FROM "qr_payment_sessions" WHERE "id" = ${id}::uuid FOR UPDATE`,
        );
        if (!rows.length) throw new NotFoundException('QR code is unavailable.');
        const session = await transaction.qrPaymentSession.findUniqueOrThrow({
          where: { id },
          select: qrSelect,
        });
        if (session.payment) {
          if (session.payment.payerId !== payerId)
            throw new NotFoundException('QR code is unavailable.');
          if (session.payment.amountMinor !== BigInt(amountMinor))
            throw new ConflictException(
              'This QR code was already confirmed with a different amount.',
            );
          return {
            ...session.payment,
            amountMinor: Number(session.payment.amountMinor),
            simulation: true as const,
          };
        }
        this.requireAvailable(session);
        if (session.amountMinor !== null && session.amountMinor !== BigInt(amountMinor))
          throw new BadRequestException('The confirmed amount must match the QR amount.');
        const payment = await this.payments.createPayment(
          {
            payerId,
            payeeId: session.ownerId,
            amountMinor,
            currency: session.currency,
            idempotencyKey: `qr-${session.id}`,
          },
          transaction,
        );
        await transaction.qrPaymentSession.update({
          where: { id },
          data: { consumedAt: new Date(), paymentId: payment.id },
        });
        await this.record(transaction, 'QR_PAYMENT_CONSUMED', id, payerId);
        return payment;
      },
      { timeout: 15000 },
    );
  }

  private validateAmount(amountMinor: number, currency: string) {
    try {
      const money = Money.fromMinor(amountMinor, currency);
      if (money.amountMinor <= 0) throw new RangeError('QR amount must be greater than zero.');
    } catch (error) {
      if (error instanceof RangeError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  private sessionId(payload: string) {
    const id = parseQrPaymentPayload(payload);
    if (!id) throw new NotFoundException('QR code is unavailable.');
    return id;
  }

  private requireAvailable(session: StoredQr | null): asserts session is StoredQr {
    if (
      !session ||
      session.consumedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      !session.owner.phoneVerifiedAt ||
      !session.owner.directoryListingEnabled
    )
      throw new NotFoundException('QR code is unavailable.');
  }

  private async requirePayer(client: Prisma.TransactionClient, payerId: string) {
    const payer = await client.user.findUnique({
      where: { id: payerId },
      select: { phoneVerifiedAt: true },
    });
    if (!payer?.phoneVerifiedAt)
      throw new ConflictException('Payer identity must have a verified phone number.');
  }

  private retryCode(session: StoredQr, amountMinor: number | null, currency: string) {
    if (
      session.amountMinor !== (amountMinor === null ? null : BigInt(amountMinor)) ||
      session.currency !== currency
    )
      throw new ConflictException('Idempotency key was already used with a different request.');
    return this.toCode(session);
  }

  private summary(session: StoredQr) {
    return {
      id: session.id,
      ownerId: session.ownerId,
      recipient: { id: session.owner.id, username: session.owner.username },
      amountMinor: session.amountMinor === null ? null : Number(session.amountMinor),
      currency: session.currency,
      state: session.consumedAt
        ? ('USED' as const)
        : session.expiresAt.getTime() <= Date.now()
          ? ('EXPIRED' as const)
          : !session.owner.phoneVerifiedAt || !session.owner.directoryListingEnabled
            ? ('UNAVAILABLE' as const)
            : ('AVAILABLE' as const),
      expiresAt: session.expiresAt,
      consumedAt: session.consumedAt,
      createdAt: session.createdAt,
      paymentId: session.payment?.id ?? null,
      simulation: true as const,
    };
  }

  private async toCode(session: StoredQr) {
    const payload = `kliks:pay:v1:${session.id}`;
    return {
      ...this.summary(session),
      payload,
      imageDataUrl: await QRCode.toDataURL(payload, {
        width: 320,
        margin: 4,
        errorCorrectionLevel: 'M',
      }),
    };
  }

  private async record(
    transaction: Prisma.TransactionClient,
    type: AuditEventType,
    entityId: string,
    actorId: string,
  ) {
    await this.audit.append(
      {
        eventId: randomUUID(),
        type,
        entityId,
        occurredAt: new Date(),
        metadata: { actorId, simulation: true },
      },
      transaction,
    );
  }
}
