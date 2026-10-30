export type AuditEventType =
  | 'USER_CREATED'
  | 'PHONE_VERIFICATION_STARTED'
  | 'PHONE_VERIFIED'
  | 'BANK_CONNECTION_STARTED'
  | 'BANK_CONNECTION_SUCCEEDED'
  | 'BANK_CONNECTION_FAILED'
  | 'BANK_CONNECTION_DISCONNECTED'
  | 'BANK_ACCOUNT_DEFAULT_CHANGED'
  | 'DIRECTORY_VISIBILITY_ENABLED'
  | 'DIRECTORY_VISIBILITY_DISABLED'
  | 'PAYMENT_CREATED'
  | 'PAYMENT_AUTHORIZATION_REQUIRED'
  | 'PAYMENT_AUTHORIZED'
  | 'PAYMENT_PROCESSING'
  | 'PAYMENT_SUCCEEDED'
  | 'PAYMENT_REJECTED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_REQUEST_CREATED'
  | 'PAYMENT_REQUEST_ACCEPTED'
  | 'PAYMENT_REQUEST_REJECTED'
  | 'PAYMENT_REQUEST_CANCELLED';

export type AuditMetadata = Readonly<Record<string, string | number | boolean | null>>;

export interface AuditEvent {
  readonly eventId: string;
  readonly type: AuditEventType;
  readonly entityId: string;
  readonly occurredAt: Date;
  readonly metadata: AuditMetadata;
}

export interface AuditEventStore {
  append(event: AuditEvent): Promise<void>;
}
