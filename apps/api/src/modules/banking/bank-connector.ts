import type { Money } from '@kliks/shared';

export interface PaymentInitiationRequest {
  paymentId: string;
  destinationReference: string;
  amount: Money;
}

export type MockAuthorizationDecision = 'APPROVE' | 'REJECT';

export interface ConnectAccountRequest {
  connectionId: string;
}

export interface ConnectAccountResult {
  providerAccountReference: string;
  displayName: string;
  status: 'PENDING_AUTHORIZATION';
  simulation: true;
}

export interface AccountAuthorizationResult {
  providerAccountReference: string;
  status: 'CONNECTED' | 'REJECTED';
  simulation: true;
}

export interface AccountDisconnectionResult {
  providerAccountReference: string;
  status: 'DISCONNECTED';
  simulation: true;
}

export interface PaymentInitiationResult {
  providerReference: string;
  status: 'PENDING';
  simulation: true;
}

export interface ProviderPaymentStatus {
  providerReference: string;
  status: 'PENDING' | 'NOT_FOUND';
  simulation: true;
}

export interface BankConnector {
  connectAccount(request: ConnectAccountRequest): Promise<ConnectAccountResult>;
  authorizeAccount(
    providerAccountReference: string,
    decision: MockAuthorizationDecision,
  ): Promise<AccountAuthorizationResult>;
  disconnectAccount(providerAccountReference: string): Promise<AccountDisconnectionResult>;
  initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResult>;
  getPaymentStatus(providerReference: string): Promise<ProviderPaymentStatus>;
}

export const BANK_CONNECTOR = Symbol('BANK_CONNECTOR');
