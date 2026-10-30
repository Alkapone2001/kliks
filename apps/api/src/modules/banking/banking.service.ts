import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@kliks/database';
import { DatabaseService } from '../../database/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditEventType } from '../audit/audit-event.js';
import {
  BANK_CONNECTOR,
  type BankConnector,
  type MockAuthorizationDecision,
} from './bank-connector.js';

export type BankAccountConnectionStatus =
  'PENDING_AUTHORIZATION' | 'CONNECTED' | 'REJECTED' | 'DISCONNECTED';

export interface PublicLinkedBankAccount {
  id: string;
  connectorId: string;
  displayName: string;
  status: BankAccountConnectionStatus;
  isDefault: boolean;
  createdAt: Date;
  simulation: true;
}

const accountSelect = {
  id: true,
  connectorId: true,
  displayName: true,
  connectionStatus: true,
  isDefault: true,
  createdAt: true,
} satisfies Prisma.LinkedBankAccountSelect;

@Injectable()
export class BankingService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BANK_CONNECTOR) private readonly bankConnector: BankConnector,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async connectAccount(userId: string): Promise<PublicLinkedBankAccount> {
    const user = await this.database.client.user.findUnique({
      where: { id: userId },
      select: { id: true, phoneVerifiedAt: true },
    });
    if (!user) {
      throw new NotFoundException('Identity not found.');
    }
    if (!user.phoneVerifiedAt) {
      throw new ConflictException('Verify the phone number before connecting an account.');
    }

    const id = randomUUID();
    const providerAccount = await this.bankConnector.connectAccount({ connectionId: id });
    const account = await this.database.client.$transaction(async (transaction) => {
      const created = await transaction.linkedBankAccount.create({
        data: {
          id,
          userId,
          connectorId: 'mock-bank',
          providerAccountReference: providerAccount.providerAccountReference,
          displayName: providerAccount.displayName,
          connectionStatus: providerAccount.status,
        },
        select: accountSelect,
      });
      await this.recordAudit(transaction, 'BANK_CONNECTION_STARTED', id, {
        connectorId: 'mock-bank',
        simulation: true,
      });
      return created;
    });

    return this.toPublicAccount(account);
  }

  async listAccounts(userId: string): Promise<PublicLinkedBankAccount[]> {
    await this.requireUser(userId);
    const accounts = await this.database.client.linkedBankAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: accountSelect,
    });
    return accounts.map((account) => this.toPublicAccount(account));
  }

  async authorizeAccount(
    userId: string,
    accountId: string,
    decision: MockAuthorizationDecision,
  ): Promise<PublicLinkedBankAccount> {
    const account = await this.database.client.linkedBankAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) {
      throw new NotFoundException('Linked account not found.');
    }
    if (account.connectionStatus !== 'PENDING_AUTHORIZATION') {
      throw new ConflictException('Linked account is not awaiting authorization.');
    }

    const providerResult = await this.bankConnector.authorizeAccount(
      account.providerAccountReference,
      decision,
    );
    const eventType: AuditEventType =
      providerResult.status === 'CONNECTED'
        ? 'BANK_CONNECTION_SUCCEEDED'
        : 'BANK_CONNECTION_FAILED';
    const updated = await this.database.client.$transaction(async (transaction) => {
      const result = await transaction.linkedBankAccount.updateMany({
        where: {
          id: accountId,
          userId,
          connectionStatus: 'PENDING_AUTHORIZATION',
        },
        data: { connectionStatus: providerResult.status },
      });
      if (result.count !== 1) {
        throw new ConflictException('Linked account is no longer awaiting authorization.');
      }

      const current = await transaction.linkedBankAccount.findUniqueOrThrow({
        where: { id: accountId },
        select: accountSelect,
      });
      await this.recordAudit(transaction, eventType, accountId, {
        connectorId: account.connectorId,
        outcome: providerResult.status,
        simulation: true,
      });
      return current;
    });

    return this.toPublicAccount(updated);
  }

  async setDefaultAccount(userId: string, accountId: string): Promise<PublicLinkedBankAccount> {
    const updated = await this.database.client.$transaction(async (transaction) => {
      const account = await transaction.linkedBankAccount.findFirst({
        where: { id: accountId, userId },
      });
      if (!account) {
        throw new NotFoundException('Linked account not found.');
      }
      if (account.connectionStatus !== 'CONNECTED') {
        throw new ConflictException('Only connected accounts can be selected as default.');
      }
      if (!account.isDefault) {
        await transaction.linkedBankAccount.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
        await transaction.linkedBankAccount.update({
          where: { id: accountId },
          data: { isDefault: true },
        });
        await this.recordAudit(transaction, 'BANK_ACCOUNT_DEFAULT_CHANGED', accountId, {
          connectorId: account.connectorId,
          simulation: true,
        });
      }

      return transaction.linkedBankAccount.findUniqueOrThrow({
        where: { id: accountId },
        select: accountSelect,
      });
    });

    return this.toPublicAccount(updated);
  }

  async disconnectAccount(userId: string, accountId: string): Promise<PublicLinkedBankAccount> {
    const account = await this.database.client.linkedBankAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) {
      throw new NotFoundException('Linked account not found.');
    }
    if (account.connectionStatus !== 'CONNECTED') {
      throw new ConflictException('Only connected accounts can be disconnected.');
    }

    const providerResult = await this.bankConnector.disconnectAccount(
      account.providerAccountReference,
    );
    const updated = await this.database.client.$transaction(async (transaction) => {
      const result = await transaction.linkedBankAccount.updateMany({
        where: { id: accountId, userId, connectionStatus: 'CONNECTED' },
        data: { connectionStatus: providerResult.status, isDefault: false },
      });
      if (result.count !== 1) {
        throw new ConflictException('Linked account is no longer connected.');
      }

      const current = await transaction.linkedBankAccount.findUniqueOrThrow({
        where: { id: accountId },
        select: accountSelect,
      });
      await this.recordAudit(transaction, 'BANK_CONNECTION_DISCONNECTED', accountId, {
        connectorId: account.connectorId,
        simulation: true,
      });
      return current;
    });

    return this.toPublicAccount(updated);
  }

  private async requireUser(userId: string): Promise<void> {
    const user = await this.database.client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Identity not found.');
    }
  }

  private async recordAudit(
    transaction: Prisma.TransactionClient,
    type: AuditEventType,
    entityId: string,
    metadata: Readonly<Record<string, string | boolean>>,
  ): Promise<void> {
    await this.audit.append(
      {
        eventId: randomUUID(),
        type,
        entityId,
        occurredAt: new Date(),
        metadata,
      },
      transaction,
    );
  }

  private toPublicAccount(account: {
    id: string;
    connectorId: string;
    displayName: string;
    connectionStatus: string;
    isDefault: boolean;
    createdAt: Date;
  }): PublicLinkedBankAccount {
    return {
      id: account.id,
      connectorId: account.connectorId,
      displayName: account.displayName,
      status: account.connectionStatus as BankAccountConnectionStatus,
      isDefault: account.isDefault,
      createdAt: account.createdAt,
      simulation: true,
    };
  }
}
