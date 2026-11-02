import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { BankingService } from '../banking/banking.service.js';
import { DirectoryService } from '../directory/directory.service.js';
import { PaymentRequestsService } from '../payment-requests/payment-requests.service.js';
import { SplitBillsService } from '../split-bills/split-bills.service.js';
import { MerchantsService } from '../merchants/merchants.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AdminActionDto, AdminQueryDto } from './admin.dto.js';
import type { AuditEventType } from '../audit/audit-event.js';

export interface AdminRow {
  id: string;
  label: string;
  description: string;
  state: string;
  createdAt: Date;
  amountMinor?: number;
  details: Record<string, string | number | boolean | null>;
  actions: string[];
  identity?: { id: string; username: string };
}
@Injectable()
export class AdminService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BankingService) private readonly banking: BankingService,
    @Inject(DirectoryService) private readonly directory: DirectoryService,
    @Inject(PaymentRequestsService) private readonly requests: PaymentRequestsService,
    @Inject(SplitBillsService) private readonly bills: SplitBillsService,
    @Inject(MerchantsService) private readonly merchants: MerchantsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async overview() {
    const client = this.database.client;
    const [users, verified, accounts, payments, requests, merchants, bills, qr, audit] =
      await Promise.all([
        client.user.count(),
        client.user.count({ where: { phoneVerifiedAt: { not: null } } }),
        client.linkedBankAccount.count(),
        client.payment.count(),
        client.paymentRequest.count(),
        client.merchantProfile.count(),
        client.splitBill.count(),
        client.qrPaymentSession.count(),
        client.auditEventRecord.count(),
      ]);
    return {
      counts: { users, verified, accounts, payments, requests, merchants, bills, qr, audit },
      persistence: 'PostgreSQL server records; browser identity lists are not the database.',
      simulation: true,
    };
  }

  async records(
    query: AdminQueryDto,
  ): Promise<{ items: AdminRow[]; nextCursor: string | null; simulation: true }> {
    const client = this.database.client;
    const q = query.q?.trim() ?? '';
    const filter = q ? { contains: q, mode: 'insensitive' as const } : undefined;
    const pagination = {
      take: 26,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
    let rows: AdminRow[];
    switch (query.kind) {
      case 'users': {
        const values = await client.user.findMany({
          ...pagination,
          orderBy,
          where: filter ? { username: filter } : {},
          select: {
            id: true,
            username: true,
            phoneVerifiedAt: true,
            directoryListingEnabled: true,
            createdAt: true,
            _count: {
              select: { linkedBankAccounts: true, paymentsInitiated: true, paymentsReceived: true },
            },
          },
        });
        rows = values.map((entry) => ({
          id: entry.id,
          label: '@' + entry.username,
          description: `${entry._count.linkedBankAccounts} accounts / ${entry._count.paymentsInitiated + entry._count.paymentsReceived} payments`,
          state: entry.phoneVerifiedAt ? 'VERIFIED' : 'UNVERIFIED',
          createdAt: entry.createdAt,
          details: {
            directoryEnabled: entry.directoryListingEnabled,
            verified: !!entry.phoneVerifiedAt,
            ...entry._count,
          },
          actions: entry.phoneVerifiedAt ? ['directory', 'connect-account'] : [],
          ...(entry.phoneVerifiedAt
            ? { identity: { id: entry.id, username: entry.username } }
            : {}),
        }));
        break;
      }
      case 'accounts': {
        const values = await client.linkedBankAccount.findMany({
          ...pagination,
          orderBy,
          where: filter ? { user: { username: filter } } : {},
          select: {
            id: true,
            userId: true,
            user: { select: { username: true } },
            displayName: true,
            connectionStatus: true,
            isDefault: true,
            createdAt: true,
          },
        });
        rows = values.map((entry) => ({
          id: entry.id,
          label: entry.displayName,
          description: '@' + entry.user.username,
          state: entry.connectionStatus,
          createdAt: entry.createdAt,
          details: { userId: entry.userId, default: entry.isDefault },
          actions:
            entry.connectionStatus === 'PENDING_AUTHORIZATION'
              ? ['approve-account', 'reject-account']
              : entry.connectionStatus === 'CONNECTED'
                ? [...(!entry.isDefault ? ['default-account'] : []), 'disconnect-account']
                : [],
        }));
        break;
      }
      case 'payments': {
        const values = await client.payment.findMany({
          ...pagination,
          orderBy,
          where: filter
            ? { OR: [{ payer: { username: filter } }, { payee: { username: filter } }] }
            : {},
          select: {
            id: true,
            payer: { select: { username: true } },
            payee: { select: { username: true } },
            amountMinor: true,
            state: true,
            failureCode: true,
            createdAt: true,
          },
        });
        rows = values.map((entry) => ({
          id: entry.id,
          label: '@' + entry.payer.username,
          description: 'To @' + entry.payee.username,
          state: entry.state,
          amountMinor: Number(entry.amountMinor),
          createdAt: entry.createdAt,
          details: { failureCode: entry.failureCode },
          actions: [],
        }));
        break;
      }
      case 'requests': {
        const values = await client.paymentRequest.findMany({
          ...pagination,
          orderBy,
          where: filter
            ? { OR: [{ requester: { username: filter } }, { payer: { username: filter } }] }
            : {},
          select: {
            id: true,
            requester: { select: { username: true } },
            payer: { select: { username: true } },
            amountMinor: true,
            state: true,
            createdAt: true,
            payment: { select: { id: true, state: true } },
          },
        });
        rows = values.map((entry) => ({
          id: entry.id,
          label: '@' + entry.requester.username,
          description: 'Requested from @' + entry.payer.username,
          state: entry.state,
          amountMinor: Number(entry.amountMinor),
          createdAt: entry.createdAt,
          details: {
            paymentId: entry.payment?.id ?? null,
            paymentState: entry.payment?.state ?? null,
          },
          actions: entry.state === 'PENDING' ? ['cancel-request', 'reject-request'] : [],
        }));
        break;
      }
      case 'merchants': {
        const values = await client.merchantProfile.findMany({
          ...pagination,
          orderBy,
          where: filter ? { displayName: filter } : {},
          select: {
            id: true,
            displayName: true,
            ownerId: true,
            owner: { select: { username: true } },
            createdAt: true,
            members: { select: { user: { select: { username: true } }, role: true } },
          },
        });
        rows = values.map((entry) => ({
          id: entry.id,
          label: entry.displayName,
          description: 'Owner @' + entry.owner.username,
          state: 'SIMULATED',
          createdAt: entry.createdAt,
          details: {
            ownerId: entry.ownerId,
            staff:
              entry.members
                .map((member) => `@${member.user.username}: ${member.role}`)
                .join(', ') || 'No staff',
          },
          actions: ['rename-merchant', 'merchant-member'],
        }));
        break;
      }
      case 'bills': {
        const values = await client.splitBill.findMany({
          ...pagination,
          orderBy,
          where: filter ? { title: filter } : {},
          select: {
            id: true,
            title: true,
            creator: { select: { username: true } },
            totalMinor: true,
            state: true,
            createdAt: true,
            shares: {
              select: {
                request: { select: { state: true, payment: { select: { state: true } } } },
              },
            },
          },
        });
        rows = values.map((entry) => ({
          id: entry.id,
          label: entry.title,
          description: 'By @' + entry.creator.username,
          state: entry.state,
          createdAt: entry.createdAt,
          amountMinor: Number(entry.totalMinor),
          details: {
            participants: entry.shares.length,
            accepted: entry.shares.filter((share) => share.request?.state === 'ACCEPTED').length,
            succeeded: entry.shares.filter((share) => share.request?.payment?.state === 'SUCCEEDED')
              .length,
          },
          actions:
            entry.state === 'OPEN' &&
            !entry.shares.some((share) => share.request?.state === 'ACCEPTED')
              ? ['cancel-bill']
              : [],
        }));
        break;
      }
      case 'qr': {
        const values = await client.qrPaymentSession.findMany({
          ...pagination,
          orderBy,
          where: filter ? { owner: { username: filter } } : {},
          select: {
            id: true,
            owner: {
              select: { username: true, phoneVerifiedAt: true, directoryListingEnabled: true },
            },
            merchant: { select: { displayName: true } },
            amountMinor: true,
            expiresAt: true,
            consumedAt: true,
            paymentId: true,
            createdAt: true,
          },
        });
        rows = values.map((entry) => ({
          id: entry.id,
          label: entry.merchant?.displayName ?? '@' + entry.owner.username,
          description: entry.amountMinor === null ? 'Open amount' : 'Fixed amount',
          state: entry.consumedAt
            ? 'USED'
            : entry.expiresAt.getTime() <= Date.now()
              ? 'EXPIRED'
              : !entry.owner.phoneVerifiedAt || !entry.owner.directoryListingEnabled
                ? 'UNAVAILABLE'
                : 'AVAILABLE',
          ...(entry.amountMinor === null ? {} : { amountMinor: Number(entry.amountMinor) }),
          createdAt: entry.createdAt,
          details: { expiresAt: entry.expiresAt.toISOString(), paymentId: entry.paymentId },
          actions: [],
        }));
        break;
      }
      case 'audit': {
        const values = await client.auditEventRecord.findMany({
          ...pagination,
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          where: filter ? { eventType: filter } : {},
          select: { id: true, eventType: true, entityId: true, occurredAt: true },
        });
        rows = values.map((entry) => ({
          id: entry.id,
          label: entry.eventType,
          description: entry.entityId,
          state: 'RECORDED',
          createdAt: entry.occurredAt,
          details: { entityId: entry.entityId },
          actions: [],
        }));
        break;
      }
      default:
        throw new BadRequestException('Unknown administration view.');
    }
    const items = rows.slice(0, 25);
    return {
      items,
      nextCursor: rows.length > 25 ? (items[items.length - 1]?.id ?? null) : null,
      simulation: true,
    };
  }

  async action(input: AdminActionDto) {
    await this.record('ADMIN_ACTION_REQUESTED', input);
    try {
      await this.mutate(input);
    } catch (error) {
      await this.record('ADMIN_ACTION_FAILED', input);
      throw error;
    }
    await this.record('ADMIN_ACTION_COMPLETED', input);
    return { ok: true, simulation: true };
  }

  private async mutate(input: AdminActionDto) {
    const client = this.database.client;
    switch (input.action) {
      case 'directory':
        if (typeof input.enabled !== 'boolean')
          throw new BadRequestException('Choose directory visibility.');
        return this.directory.setVisibility(input.id, input.enabled);
      case 'connect-account':
        return this.banking.connectAccount(input.id);
      case 'approve-account':
      case 'reject-account':
      case 'default-account':
      case 'disconnect-account': {
        const account = await client.linkedBankAccount.findUnique({
          where: { id: input.id },
          select: { userId: true },
        });
        if (!account) throw new NotFoundException('Account not found.');
        if (input.action === 'default-account')
          return this.banking.setDefaultAccount(account.userId, input.id);
        if (input.action === 'disconnect-account')
          return this.banking.disconnectAccount(account.userId, input.id);
        return this.banking.authorizeAccount(
          account.userId,
          input.id,
          input.action === 'approve-account' ? 'APPROVE' : 'REJECT',
        );
      }
      case 'cancel-request':
      case 'reject-request': {
        const request = await client.paymentRequest.findUnique({
          where: { id: input.id },
          select: { requesterId: true, payerId: true },
        });
        if (!request) throw new NotFoundException('Request not found.');
        return input.action === 'cancel-request'
          ? this.requests.cancel(input.id, request.requesterId)
          : this.requests.reject(input.id, request.payerId);
      }
      case 'cancel-bill': {
        const bill = await client.splitBill.findUnique({
          where: { id: input.id },
          select: { creatorId: true },
        });
        if (!bill) throw new NotFoundException('Bill not found.');
        return this.bills.cancel(input.id, bill.creatorId);
      }
      case 'rename-merchant':
      case 'merchant-member': {
        const merchant = await client.merchantProfile.findUnique({
          where: { id: input.id },
          select: { ownerId: true },
        });
        if (!merchant) throw new NotFoundException('Merchant not found.');
        if (input.action === 'rename-merchant') {
          if (!input.name?.trim()) throw new BadRequestException('Enter a merchant name.');
          return this.merchants.update(input.id, merchant.ownerId, input.name);
        }
        if (!input.memberId || !input.role)
          throw new BadRequestException('Choose a staff identity and role.');
        return this.merchants.member(input.id, merchant.ownerId, input.memberId, input.role);
      }
      default:
        throw new BadRequestException('Unsupported administrative action.');
    }
  }

  private async record(type: AuditEventType, input: AdminActionDto) {
    await this.audit.append({
      eventId: randomUUID(),
      type,
      entityId: input.id,
      occurredAt: new Date(),
      metadata: { actor: 'demo-admin', action: input.action, simulation: true },
    });
  }
}
