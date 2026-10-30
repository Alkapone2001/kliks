import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentRequestState, Prisma } from '@kliks/database';
import { Money } from '@kliks/shared';
import { DatabaseService } from '../../database/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditEventType } from '../audit/audit-event.js';
import { PaymentsService } from '../payments/payments.service.js';

interface CreateRequestInput {
  requesterId: string;
  payerId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
}

const requestSelect = {
  id: true,
  requesterId: true,
  payerId: true,
  amountMinor: true,
  currency: true,
  state: true,
  idempotencyKey: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { id: true, username: true } },
  payer: { select: { id: true, username: true } },
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
} satisfies Prisma.PaymentRequestSelect;
type StoredRequest = Prisma.PaymentRequestGetPayload<{ select: typeof requestSelect }>;

@Injectable()
export class PaymentRequestsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(input: CreateRequestInput) {
    if (input.requesterId === input.payerId)
      throw new BadRequestException('Choose a different payer.');
    try {
      const money = Money.fromMinor(input.amountMinor, input.currency);
      if (money.amountMinor <= 0) throw new RangeError('Request amount must be greater than zero.');
    } catch (error) {
      if (error instanceof RangeError) throw new BadRequestException(error.message);
      throw error;
    }
    const key = input.idempotencyKey.trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key))
      throw new BadRequestException('Idempotency key must be 8 to 128 safe characters.');
    const where = {
      requesterId_idempotencyKey: { requesterId: input.requesterId, idempotencyKey: key },
    };
    const existing = await this.database.client.paymentRequest.findUnique({
      where,
      select: requestSelect,
    });
    if (existing) return this.resolveRetry(existing, input);
    try {
      const created = await this.database.client.$transaction(async (transaction) => {
        const users = await transaction.user.findMany({
          where: { id: { in: [input.requesterId, input.payerId] } },
          select: { id: true, phoneVerifiedAt: true, directoryListingEnabled: true },
        });
        const requester = users.find((user) => user.id === input.requesterId);
        if (!requester?.phoneVerifiedAt)
          throw new ConflictException('Requester identity must have a verified phone number.');
        if (!requester.directoryListingEnabled)
          throw new ConflictException(
            'Enable recipient discovery before creating a payment request.',
          );
        const payer = users.find((user) => user.id === input.payerId);
        if (!payer?.phoneVerifiedAt || !payer.directoryListingEnabled)
          throw new NotFoundException('Recipient not found.');
        const request = await transaction.paymentRequest.create({
          data: {
            requesterId: input.requesterId,
            payerId: input.payerId,
            amountMinor: BigInt(input.amountMinor),
            currency: input.currency,
            idempotencyKey: key,
          },
          select: requestSelect,
        });
        await this.record(transaction, 'PAYMENT_REQUEST_CREATED', request.id, input.requesterId);
        return request;
      });
      return this.toPublic(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await this.database.client.paymentRequest.findUnique({
          where,
          select: requestSelect,
        });
        if (duplicate) return this.resolveRetry(duplicate, input);
      }
      throw error;
    }
  }

  async list(userId: string) {
    if (
      !(await this.database.client.user.findUnique({ where: { id: userId }, select: { id: true } }))
    )
      throw new NotFoundException('Identity not found.');
    const requests = await this.database.client.paymentRequest.findMany({
      where: { OR: [{ requesterId: userId }, { payerId: userId }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: requestSelect,
    });
    return requests.map((request) => this.toPublic(request));
  }

  async get(requestId: string, userId: string) {
    const request = await this.database.client.paymentRequest.findFirst({
      where: { id: requestId, OR: [{ requesterId: userId }, { payerId: userId }] },
      select: requestSelect,
    });
    if (!request) throw new NotFoundException('Payment request not found.');
    return this.toPublic(request);
  }

  async accept(requestId: string, payerId: string) {
    return this.database.client.$transaction(
      async (transaction) => {
        const request = await this.lock(transaction, requestId, payerId);
        if (request.payerId !== payerId) throw new NotFoundException('Payment request not found.');
        if (request.state === PaymentRequestState.ACCEPTED) return this.toPublic(request);
        if (request.state !== PaymentRequestState.PENDING)
          throw new ConflictException('Payment request is no longer pending.');
        const payment = await this.payments.createPayment(
          {
            payerId,
            payeeId: request.requesterId,
            amountMinor: Number(request.amountMinor),
            currency: request.currency,
            idempotencyKey: `request-${request.id}`,
          },
          transaction,
        );
        const updated = await transaction.paymentRequest.update({
          where: { id: request.id },
          data: { state: PaymentRequestState.ACCEPTED, paymentId: payment.id },
          select: requestSelect,
        });
        await this.record(transaction, 'PAYMENT_REQUEST_ACCEPTED', request.id, payerId);
        return this.toPublic(updated);
      },
      { timeout: 15000 },
    );
  }

  reject(requestId: string, payerId: string) {
    return this.close(requestId, payerId, PaymentRequestState.REJECTED);
  }
  cancel(requestId: string, requesterId: string) {
    return this.close(requestId, requesterId, PaymentRequestState.CANCELLED);
  }

  private async close(requestId: string, actorId: string, state: 'REJECTED' | 'CANCELLED') {
    return this.database.client.$transaction(async (transaction) => {
      const request = await this.lock(transaction, requestId, actorId);
      const expectedActor = state === 'REJECTED' ? request.payerId : request.requesterId;
      if (expectedActor !== actorId) throw new NotFoundException('Payment request not found.');
      if (request.state === state) return this.toPublic(request);
      if (request.state !== PaymentRequestState.PENDING)
        throw new ConflictException('Payment request is no longer pending.');
      const updated = await transaction.paymentRequest.update({
        where: { id: requestId },
        data: { state },
        select: requestSelect,
      });
      await this.record(
        transaction,
        state === 'REJECTED' ? 'PAYMENT_REQUEST_REJECTED' : 'PAYMENT_REQUEST_CANCELLED',
        requestId,
        actorId,
      );
      return this.toPublic(updated);
    });
  }

  private async lock(transaction: Prisma.TransactionClient, requestId: string, actorId: string) {
    const rows = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "payment_requests" WHERE "id" = ${requestId}::uuid
      AND ("requester_id" = ${actorId}::uuid OR "payer_id" = ${actorId}::uuid) FOR UPDATE
    `);
    if (!rows.length) throw new NotFoundException('Payment request not found.');
    return transaction.paymentRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: requestSelect,
    });
  }

  private resolveRetry(request: StoredRequest, input: CreateRequestInput) {
    if (
      request.payerId !== input.payerId ||
      request.amountMinor !== BigInt(input.amountMinor) ||
      request.currency !== input.currency
    )
      throw new ConflictException('Idempotency key was already used with a different request.');
    return this.toPublic(request);
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

  private toPublic(request: StoredRequest) {
    const amountMinor = Number(request.amountMinor);
    if (!Number.isSafeInteger(amountMinor))
      throw new Error('Stored request amount exceeds the safe integer range.');
    return {
      id: request.id,
      requesterId: request.requesterId,
      payerId: request.payerId,
      requester: request.requester,
      payer: request.payer,
      amountMinor,
      currency: request.currency,
      state: request.state,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      simulation: true as const,
      payment: request.payment
        ? {
            ...request.payment,
            amountMinor: Number(request.payment.amountMinor),
            simulation: true as const,
          }
        : null,
    };
  }
}
