import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@kliks/database';
import { DatabaseService } from '../../database/database.service.js';
import type { AuditEvent, AuditEventStore } from './audit-event.js';

@Injectable()
export class AuditService implements AuditEventStore {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async append(event: AuditEvent, transaction?: Prisma.TransactionClient): Promise<void> {
    const client = transaction ?? this.database.client;
    await client.auditEventRecord.create({
      data: {
        id: event.eventId,
        eventType: event.type,
        entityId: event.entityId,
        occurredAt: event.occurredAt,
        metadata: event.metadata as Prisma.InputJsonObject,
      },
    });
  }
}
