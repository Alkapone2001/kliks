import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@kliks/database';
import { allocateSplitBill, Money, type SplitMode, type SplitParticipant } from '@kliks/shared';
import { DatabaseService } from '../../database/database.service.js';
import type { AuditEventType } from '../audit/audit-event.js';
import { AuditService } from '../audit/audit.service.js';
import { PaymentRequestsService } from '../payment-requests/payment-requests.service.js';

interface CreateBillInput {
  creatorId: string;
  title: string;
  totalMinor: number;
  currency: string;
  mode: SplitMode;
  participants: SplitParticipant[];
  idempotencyKey: string;
}
const billSelect = {
  id: true,
  creatorId: true,
  title: true,
  totalMinor: true,
  currency: true,
  mode: true,
  state: true,
  requestFingerprint: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: { id: true, username: true } },
  shares: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      userId: true,
      amountMinor: true,
      position: true,
      user: { select: { id: true, username: true } },
      request: {
        select: {
          id: true,
          state: true,
          payment: { select: { id: true, state: true, failureCode: true } },
        },
      },
    },
  },
} satisfies Prisma.SplitBillSelect;
type StoredBill = Prisma.SplitBillGetPayload<{ select: typeof billSelect }>;

@Injectable()
export class SplitBillsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(PaymentRequestsService) private readonly requests: PaymentRequestsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(input: CreateBillInput) {
    const title = input.title.trim();
    if (!title || title.length > 80)
      throw new BadRequestException('Enter a bill name of 1 to 80 characters.');
    if (new Set(input.participants.map((entry) => entry.userId)).size !== input.participants.length)
      throw new BadRequestException('Choose distinct participants.');
    const creator = input.participants.find((entry) => entry.userId === input.creatorId);
    if (!creator) throw new BadRequestException('The bill must include the creator share.');
    const participants = [creator, ...input.participants.filter((entry) => entry !== creator)];
    let allocations;
    try {
      Money.fromMinor(input.totalMinor, input.currency);
      allocations = allocateSplitBill(input.totalMinor, input.mode, participants);
    } catch (error) {
      if (error instanceof RangeError) throw new BadRequestException(error.message);
      throw error;
    }
    const key = input.idempotencyKey.trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key))
      throw new BadRequestException('Idempotency key must be 8 to 128 safe characters.');
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          title,
          totalMinor: input.totalMinor,
          currency: input.currency,
          mode: input.mode,
          allocations: [...allocations].sort((first, second) =>
            first.userId.localeCompare(second.userId),
          ),
        }),
      )
      .digest('hex');
    const where = { creatorId_idempotencyKey: { creatorId: input.creatorId, idempotencyKey: key } };
    const existing = await this.database.client.splitBill.findUnique({ where, select: billSelect });
    if (existing) return this.retry(existing, fingerprint);
    try {
      const bill = await this.database.client.$transaction(
        async (transaction) => {
          const users = await transaction.user.findMany({
            where: { id: { in: allocations.map((entry) => entry.userId) } },
            select: { id: true, phoneVerifiedAt: true, directoryListingEnabled: true },
          });
          const owner = users.find((user) => user.id === input.creatorId);
          if (!owner?.phoneVerifiedAt || !owner.directoryListingEnabled)
            throw new ConflictException(
              'Verify your identity and enable recipient discovery before creating a bill.',
            );
          if (
            allocations.some(
              (entry) =>
                !users.some(
                  (user) =>
                    user.id === entry.userId &&
                    user.phoneVerifiedAt &&
                    user.directoryListingEnabled,
                ),
            )
          )
            throw new NotFoundException('Participant not found.');
          const created = await transaction.splitBill.create({
            data: {
              creatorId: input.creatorId,
              title,
              totalMinor: BigInt(input.totalMinor),
              currency: input.currency,
              mode: input.mode,
              idempotencyKey: key,
              requestFingerprint: fingerprint,
            },
            select: { id: true },
          });
          for (const [position, allocation] of allocations.entries()) {
            const request =
              allocation.userId === input.creatorId
                ? null
                : await this.requests.create(
                    {
                      requesterId: input.creatorId,
                      payerId: allocation.userId,
                      amountMinor: allocation.amountMinor,
                      currency: input.currency,
                      idempotencyKey: `bill-${created.id}-${allocation.userId}`,
                    },
                    transaction,
                  );
            await transaction.splitBillShare.create({
              data: {
                billId: created.id,
                userId: allocation.userId,
                amountMinor: BigInt(allocation.amountMinor),
                position,
                requestId: request?.id ?? null,
              },
            });
          }
          await this.record(transaction, 'SPLIT_BILL_CREATED', created.id, input.creatorId);
          return transaction.splitBill.findUniqueOrThrow({
            where: { id: created.id },
            select: billSelect,
          });
        },
        { timeout: 20000 },
      );
      return this.toPublic(bill);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await this.database.client.splitBill.findUnique({
          where,
          select: billSelect,
        });
        if (duplicate) return this.retry(duplicate, fingerprint);
      }
      throw error;
    }
  }

  async list(userId: string) {
    if (
      !(await this.database.client.user.findUnique({ where: { id: userId }, select: { id: true } }))
    )
      throw new NotFoundException('Identity not found.');
    const bills = await this.database.client.splitBill.findMany({
      where: { shares: { some: { userId } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: billSelect,
    });
    return bills.map((bill) => this.toPublic(bill));
  }

  async get(billId: string, userId: string) {
    const bill = await this.database.client.splitBill.findFirst({
      where: { id: billId, shares: { some: { userId } } },
      select: billSelect,
    });
    if (!bill) throw new NotFoundException('Split bill not found.');
    return this.toPublic(bill);
  }

  async cancel(billId: string, creatorId: string) {
    return this.database.client.$transaction(
      async (transaction) => {
        const rows = await transaction.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT "id" FROM "split_bills" WHERE "id" = ${billId}::uuid AND "creator_id" = ${creatorId}::uuid FOR UPDATE`,
        );
        if (!rows.length) throw new NotFoundException('Split bill not found.');
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "payment_requests" WHERE "id" IN (SELECT "request_id" FROM "split_bill_shares" WHERE "bill_id" = ${billId}::uuid) ORDER BY "id" FOR UPDATE`,
        );
        const bill = await transaction.splitBill.findUniqueOrThrow({
          where: { id: billId },
          select: billSelect,
        });
        if (bill.state === 'CANCELLED') return this.toPublic(bill);
        if (bill.shares.some((share) => share.request?.state === 'ACCEPTED'))
          throw new ConflictException(
            'A bill cannot be cancelled after a share has been accepted. Existing payments are retained.',
          );
        for (const share of bill.shares) {
          if (share.request?.state === 'PENDING')
            await this.requests.cancel(share.request.id, creatorId, transaction);
        }
        const updated = await transaction.splitBill.update({
          where: { id: billId },
          data: { state: 'CANCELLED' },
          select: billSelect,
        });
        await this.record(transaction, 'SPLIT_BILL_CANCELLED', billId, creatorId);
        return this.toPublic(updated);
      },
      { timeout: 20000 },
    );
  }

  private retry(bill: StoredBill, fingerprint: string) {
    if (bill.requestFingerprint !== fingerprint)
      throw new ConflictException('Idempotency key was already used with a different bill.');
    return this.toPublic(bill);
  }

  private toPublic(bill: StoredBill) {
    const requested = bill.shares.filter((share) => share.request !== null);
    const settled = requested.filter((share) => share.request?.payment?.state === 'SUCCEEDED');
    const status =
      bill.state === 'CANCELLED'
        ? 'CANCELLED'
        : settled.length === requested.length
          ? 'SETTLED'
          : settled.length > 0
            ? 'PARTIALLY_SETTLED'
            : requested.some(
                  (share) =>
                    share.request?.state === 'REJECTED' ||
                    share.request?.state === 'CANCELLED' ||
                    ['FAILED', 'REJECTED', 'CANCELLED'].includes(
                      share.request?.payment?.state ?? '',
                    ),
                )
              ? 'NEEDS_ATTENTION'
              : requested.some((share) => share.request?.state === 'ACCEPTED')
                ? 'IN_PROGRESS'
                : 'OPEN';
    return {
      id: bill.id,
      creatorId: bill.creatorId,
      creator: bill.creator,
      title: bill.title,
      totalMinor: Number(bill.totalMinor),
      currency: bill.currency,
      mode: bill.mode,
      state: bill.state,
      status,
      requestedMinor: Number(requested.reduce((total, share) => total + share.amountMinor, 0n)),
      settledMinor: Number(settled.reduce((total, share) => total + share.amountMinor, 0n)),
      canCancel:
        bill.state === 'OPEN' && !requested.some((share) => share.request?.state === 'ACCEPTED'),
      shares: bill.shares.map((share) => ({
        id: share.id,
        user: share.user,
        amountMinor: Number(share.amountMinor),
        position: share.position,
        request: share.request,
        ownShare: share.userId === bill.creatorId,
      })),
      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt,
      simulation: true as const,
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
