import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PersistedPaymentState, Prisma } from '@kliks/database';
import { Money } from '@kliks/shared';
import { DatabaseService } from '../../database/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditEventType } from '../audit/audit-event.js';
import {
  BANK_CONNECTOR,
  type BankConnector,
  type MockAuthorizationDecision,
  type MockPaymentOutcome,
} from '../banking/bank-connector.js';
import {
  createPayment as createPaymentAggregate,
  PaymentState,
  transitionPayment,
} from './domain/payment.js';

export interface CreatePaymentInput {
  payerId: string;
  payeeId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
}

export interface AuthorizePaymentInput {
  payerId: string;
  decision: MockAuthorizationDecision;
  outcome: MockPaymentOutcome;
}

export interface PublicPayment {
  id: string;
  payerId: string;
  payeeId: string;
  amountMinor: number;
  currency: string;
  state: PaymentState;
  failureCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  simulation: true;
}

const persistedStateByDomainState: Record<PaymentState, PersistedPaymentState> = {
  [PaymentState.Created]: PersistedPaymentState.CREATED,
  [PaymentState.RequiresAuthorization]: PersistedPaymentState.REQUIRES_AUTHORIZATION,
  [PaymentState.Processing]: PersistedPaymentState.PROCESSING,
  [PaymentState.Succeeded]: PersistedPaymentState.SUCCEEDED,
  [PaymentState.Rejected]: PersistedPaymentState.REJECTED,
  [PaymentState.Failed]: PersistedPaymentState.FAILED,
  [PaymentState.Cancelled]: PersistedPaymentState.CANCELLED,
};

const domainStateByPersistedState: Record<PersistedPaymentState, PaymentState> = {
  [PersistedPaymentState.CREATED]: PaymentState.Created,
  [PersistedPaymentState.REQUIRES_AUTHORIZATION]: PaymentState.RequiresAuthorization,
  [PersistedPaymentState.PROCESSING]: PaymentState.Processing,
  [PersistedPaymentState.SUCCEEDED]: PaymentState.Succeeded,
  [PersistedPaymentState.REJECTED]: PaymentState.Rejected,
  [PersistedPaymentState.FAILED]: PaymentState.Failed,
  [PersistedPaymentState.CANCELLED]: PaymentState.Cancelled,
};

const paymentSelect = {
  id: true,
  payerId: true,
  payeeId: true,
  amountMinor: true,
  currency: true,
  state: true,
  failureCode: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentSelect;

const idempotencySelect = {
  ...paymentSelect,
  requestFingerprint: true,
} satisfies Prisma.PaymentSelect;

type IdempotencyPayment = Prisma.PaymentGetPayload<{ select: typeof idempotencySelect }>;

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BANK_CONNECTOR) private readonly bankConnector: BankConnector,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<PublicPayment> {
    const payerId = input.payerId;
    const payeeId = input.payeeId;
    if (payerId === payeeId) {
      throw new BadRequestException('Payer and recipient must be different identities.');
    }

    let amount: Money;
    try {
      amount = Money.fromMinor(input.amountMinor, input.currency);
      if (amount.amountMinor <= 0) {
        throw new RangeError('Payment amount must be greater than zero.');
      }
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const idempotencyKey = input.idempotencyKey.trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency key must be 8 to 128 safe characters.');
    }
    const requestFingerprint = this.fingerprint({ payerId, payeeId, amount });
    const existing = await this.database.client.payment.findUnique({
      where: { payerId_idempotencyKey: { payerId, idempotencyKey } },
      select: idempotencySelect,
    });
    if (existing) {
      return this.resolveIdempotent(existing, requestFingerprint);
    }

    await this.validateParticipants(payerId, payeeId);
    const [payerAccount, payeeAccount] = await Promise.all([
      this.findDefaultConnectedAccount(payerId),
      this.findDefaultConnectedAccount(payeeId),
    ]);
    if (!payerAccount) {
      throw new ConflictException('Payer has no connected default account.');
    }
    if (!payeeAccount) {
      throw new NotFoundException('Recipient not found.');
    }

    const paymentId = randomUUID();
    const providerResult = await this.bankConnector.initiatePayment({
      paymentId,
      sourceReference: payerAccount.providerAccountReference,
      destinationReference: payeeAccount.providerAccountReference,
      amount,
    });
    if (providerResult.status !== 'REQUIRES_AUTHORIZATION' || !providerResult.simulation) {
      throw new Error('Mock Bank returned an unsupported payment initiation result.');
    }

    const created = createPaymentAggregate({ id: paymentId, payerId, payeeId, amount }, new Date());
    const requiresAuthorization = transitionPayment(
      created,
      PaymentState.RequiresAuthorization,
      new Date(),
    );

    try {
      const saved = await this.database.client.$transaction(async (transaction) => {
        await transaction.payment.create({
          data: {
            id: created.id,
            payerId,
            payeeId,
            payerAccountId: payerAccount.id,
            payeeAccountId: payeeAccount.id,
            idempotencyKey,
            requestFingerprint,
            amountMinor: BigInt(amount.amountMinor),
            currency: amount.currency,
            state: PersistedPaymentState.CREATED,
            providerReference: providerResult.providerReference,
            simulation: true,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
          },
        });
        await this.recordAudit(transaction, 'PAYMENT_CREATED', paymentId, {
          amountMinor: amount.amountMinor,
          currency: amount.currency,
          simulation: true,
        });

        const payment = await transaction.payment.update({
          where: { id: paymentId },
          data: {
            state: persistedStateByDomainState[requiresAuthorization.state],
            updatedAt: requiresAuthorization.updatedAt,
          },
          select: paymentSelect,
        });
        await this.recordAudit(transaction, 'PAYMENT_AUTHORIZATION_REQUIRED', paymentId, {
          simulation: true,
        });
        return payment;
      });
      return this.toPublicPayment(saved);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await this.database.client.payment.findUnique({
          where: { payerId_idempotencyKey: { payerId, idempotencyKey } },
          select: idempotencySelect,
        });
        if (duplicate) {
          return this.resolveIdempotent(duplicate, requestFingerprint);
        }
      }
      throw error;
    }
  }

  async authorizePayment(paymentId: string, input: AuthorizePaymentInput): Promise<PublicPayment> {
    const payment = await this.database.client.payment.findFirst({
      where: { id: paymentId, payerId: input.payerId },
      select: {
        ...paymentSelect,
        providerReference: true,
      },
    });
    if (!payment || !payment.providerReference) {
      throw new NotFoundException('Payment not found.');
    }
    if (payment.state !== PersistedPaymentState.REQUIRES_AUTHORIZATION) {
      throw new ConflictException('Payment is not awaiting authorization.');
    }

    const providerResult = await this.bankConnector.authorizePayment({
      providerReference: payment.providerReference,
      decision: input.decision,
      outcome: input.outcome,
    });
    if (!providerResult.simulation) {
      throw new Error('Mock Bank returned a non-simulated payment result.');
    }

    const current = this.toPaymentAggregate(payment);
    if (input.decision === 'REJECT') {
      if (providerResult.status !== 'REJECTED') {
        throw new Error('Mock Bank returned an invalid rejection result.');
      }
      const rejected = transitionPayment(current, PaymentState.Rejected, new Date());
      return this.persistStateTransition(
        payment,
        rejected,
        'PAYMENT_REJECTED',
        providerResult.failureCode ?? 'USER_REJECTED',
      );
    }

    const processing = transitionPayment(current, PaymentState.Processing, new Date());
    if (providerResult.status === 'REJECTED') {
      throw new Error('Mock Bank returned a rejection for an approved authorization.');
    }

    const finalState =
      providerResult.status === 'SUCCEEDED'
        ? PaymentState.Succeeded
        : providerResult.status === 'FAILED'
          ? PaymentState.Failed
          : PaymentState.Processing;
    const final =
      finalState === PaymentState.Processing
        ? processing
        : transitionPayment(processing, finalState, new Date());

    const saved = await this.database.client.$transaction(async (transaction) => {
      const claimed = await transaction.payment.updateMany({
        where: {
          id: paymentId,
          payerId: input.payerId,
          state: PersistedPaymentState.REQUIRES_AUTHORIZATION,
        },
        data: { state: PersistedPaymentState.PROCESSING, updatedAt: processing.updatedAt },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Payment is no longer awaiting authorization.');
      }

      await this.recordAudit(transaction, 'PAYMENT_AUTHORIZED', paymentId, {
        simulation: true,
      });
      await this.recordAudit(transaction, 'PAYMENT_PROCESSING', paymentId, {
        simulation: true,
      });

      const updated = await transaction.payment.update({
        where: { id: paymentId },
        data: {
          state: persistedStateByDomainState[final.state],
          failureCode: providerResult.failureCode ?? null,
          updatedAt: final.updatedAt,
        },
        select: paymentSelect,
      });

      if (final.state === PaymentState.Succeeded) {
        await this.recordAudit(transaction, 'PAYMENT_SUCCEEDED', paymentId, {
          simulation: true,
        });
      } else if (final.state === PaymentState.Failed) {
        await this.recordAudit(transaction, 'PAYMENT_FAILED', paymentId, {
          failureCode: providerResult.failureCode ?? 'PROVIDER_FAILURE',
          simulation: true,
        });
      }
      return updated;
    });

    return this.toPublicPayment(saved);
  }

  async listPayments(userId: string): Promise<PublicPayment[]> {
    const user = await this.database.client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Identity not found.');
    }
    const payments = await this.database.client.payment.findMany({
      where: { OR: [{ payerId: userId }, { payeeId: userId }] },
      orderBy: { createdAt: 'desc' },
      select: paymentSelect,
    });
    return payments.map((payment) => this.toPublicPayment(payment));
  }

  private async validateParticipants(payerId: string, payeeId: string): Promise<void> {
    const users = await this.database.client.user.findMany({
      where: { id: { in: [payerId, payeeId] } },
      select: {
        id: true,
        phoneVerifiedAt: true,
        directoryListingEnabled: true,
      },
    });
    const payer = users.find((user) => user.id === payerId);
    const payee = users.find((user) => user.id === payeeId);
    if (!payer?.phoneVerifiedAt) {
      throw new ConflictException('Payer identity must have a verified phone number.');
    }
    if (!payee?.phoneVerifiedAt || !payee.directoryListingEnabled) {
      throw new NotFoundException('Recipient not found.');
    }
  }

  private findDefaultConnectedAccount(userId: string) {
    return this.database.client.linkedBankAccount.findFirst({
      where: { userId, connectionStatus: 'CONNECTED', isDefault: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, providerAccountReference: true },
    });
  }

  private fingerprint(input: { payerId: string; payeeId: string; amount: Money }): string {
    return createHash('sha256')
      .update(
        [input.payerId, input.payeeId, input.amount.amountMinor, input.amount.currency].join('\0'),
      )
      .digest('hex');
  }

  private resolveIdempotent(
    payment: IdempotencyPayment,
    requestFingerprint: string,
  ): PublicPayment {
    if (payment.requestFingerprint !== requestFingerprint) {
      throw new ConflictException('Idempotency key was already used with a different request.');
    }
    return this.toPublicPayment(payment);
  }

  private async persistStateTransition(
    payment: {
      id: string;
      payerId: string;
      state: PersistedPaymentState;
    },
    updated: ReturnType<typeof transitionPayment>,
    eventType: AuditEventType,
    failureCode: string | null,
  ): Promise<PublicPayment> {
    const saved = await this.database.client.$transaction(async (transaction) => {
      const result = await transaction.payment.updateMany({
        where: {
          id: payment.id,
          payerId: payment.payerId,
          state: PersistedPaymentState.REQUIRES_AUTHORIZATION,
        },
        data: {
          state: persistedStateByDomainState[updated.state],
          failureCode,
          updatedAt: updated.updatedAt,
        },
      });
      if (result.count !== 1) {
        throw new ConflictException('Payment is no longer awaiting authorization.');
      }
      await this.recordAudit(transaction, eventType, payment.id, {
        failureCode: failureCode ?? '',
        simulation: true,
      });
      return transaction.payment.findUniqueOrThrow({
        where: { id: payment.id },
        select: paymentSelect,
      });
    });
    return this.toPublicPayment(saved);
  }

  private async recordAudit(
    transaction: Prisma.TransactionClient,
    type: AuditEventType,
    entityId: string,
    metadata: Readonly<Record<string, string | number | boolean>>,
  ): Promise<void> {
    await this.audit.append(
      { eventId: randomUUID(), type, entityId, occurredAt: new Date(), metadata },
      transaction,
    );
  }

  private toPaymentAggregate(payment: {
    id: string;
    payerId: string;
    payeeId: string;
    amountMinor: bigint;
    currency: string;
    state: PersistedPaymentState;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const amountMinor = Number(payment.amountMinor);
    if (!Number.isSafeInteger(amountMinor)) {
      throw new Error('Stored payment amount exceeds the safe integer range.');
    }
    return {
      id: payment.id,
      payerId: payment.payerId,
      payeeId: payment.payeeId,
      amount: Money.fromMinor(amountMinor, payment.currency),
      state: domainStateByPersistedState[payment.state],
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  private toPublicPayment(payment: {
    id: string;
    payerId: string;
    payeeId: string;
    amountMinor: bigint;
    currency: string;
    state: PersistedPaymentState;
    failureCode: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PublicPayment {
    const amountMinor = Number(payment.amountMinor);
    if (!Number.isSafeInteger(amountMinor)) {
      throw new Error('Stored payment amount exceeds the safe integer range.');
    }
    return {
      id: payment.id,
      payerId: payment.payerId,
      payeeId: payment.payeeId,
      amountMinor,
      currency: payment.currency,
      state: domainStateByPersistedState[payment.state],
      failureCode: payment.failureCode,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      simulation: true,
    };
  }
}
