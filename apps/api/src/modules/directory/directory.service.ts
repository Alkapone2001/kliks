import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../database/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditEventType } from '../audit/audit-event.js';
import { KosovoPhoneNumber } from '../identity/domain/kosovo-phone-number.js';
import { Username } from '../identity/domain/username.js';

export interface RecipientPreview {
  id: string;
  username: string;
  phoneVerified: true;
  createdAt: Date;
}

export interface DirectoryVisibility {
  enabled: boolean;
}

@Injectable()
export class DirectoryService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async setVisibility(userId: string, enabled: boolean): Promise<DirectoryVisibility> {
    const user = await this.database.client.user.findUnique({
      where: { id: userId },
      select: { phoneVerifiedAt: true, directoryListingEnabled: true },
    });
    if (!user) {
      throw new NotFoundException('Identity not found.');
    }
    if (enabled && !user.phoneVerifiedAt) {
      throw new ConflictException('Verify the phone number before enabling directory visibility.');
    }

    if (user.directoryListingEnabled === enabled) {
      return { enabled };
    }

    const eventType: AuditEventType = enabled
      ? 'DIRECTORY_VISIBILITY_ENABLED'
      : 'DIRECTORY_VISIBILITY_DISABLED';
    await this.database.client.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: userId },
        data: { directoryListingEnabled: enabled },
        select: { id: true },
      });
      await this.audit.append(
        {
          eventId: randomUUID(),
          type: eventType,
          entityId: userId,
          occurredAt: new Date(),
          metadata: { enabled },
        },
        transaction,
      );
    });
    return { enabled };
  }

  async resolveByPhone(input: string): Promise<RecipientPreview> {
    let phoneNumber: KosovoPhoneNumber;
    try {
      phoneNumber = KosovoPhoneNumber.parse(input);
    } catch {
      throw this.recipientNotFound();
    }

    const recipient = await this.database.client.user.findFirst({
      where: {
        phoneNumber: phoneNumber.e164,
        phoneVerifiedAt: { not: null },
        directoryListingEnabled: true,
      },
      select: { id: true, username: true, phoneVerifiedAt: true, createdAt: true },
    });
    if (!recipient) {
      throw this.recipientNotFound();
    }
    return this.toPreview(recipient);
  }

  async resolveByUsername(input: string): Promise<RecipientPreview> {
    let username: Username;
    try {
      username = Username.parse(input);
    } catch {
      throw this.recipientNotFound();
    }

    const recipient = await this.database.client.user.findFirst({
      where: {
        username: username.value,
        phoneVerifiedAt: { not: null },
        directoryListingEnabled: true,
      },
      select: { id: true, username: true, phoneVerifiedAt: true, createdAt: true },
    });
    if (!recipient) {
      throw this.recipientNotFound();
    }
    return this.toPreview(recipient);
  }

  private recipientNotFound(): NotFoundException {
    return new NotFoundException('Recipient not found.');
  }

  private toPreview(recipient: {
    id: string;
    username: string;
    phoneVerifiedAt: Date | null;
    createdAt: Date;
  }): RecipientPreview {
    return {
      id: recipient.id,
      username: recipient.username,
      phoneVerified: true,
      createdAt: recipient.createdAt,
    };
  }
}
