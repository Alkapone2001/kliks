import type { Money } from '@kliks/shared';

export interface PaymentInitiationRequest {
  paymentId: string;
  sourceReference: string;
  destinationReference: string;
  amount: Money;
}

export type MockPaymentOutcome = 'SUCCESS' | 'PENDING' | 'INSUFFICIENT_FUNDS' | 'PROVIDER_FAILURE';

export interface PaymentAuthorizationRequest {
  providerReference: string;
  decision: MockAuthorizationDecision;
  outcome: MockPaymentOutcome;
}

export interface PaymentAuthorizationResult {
  providerReference: string;
  status: 'PROCESSING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED';
  failureCode?: 'USER_REJECTED' | 'INSUFFICIENT_FUNDS' | 'PROVIDER_FAILURE';
  simulation: true;
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
  status: 'REQUIRES_AUTHORIZATION';
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
  authorizePayment(request: PaymentAuthorizationRequest): Promise<PaymentAuthorizationResult>;
  getPaymentStatus(providerReference: string): Promise<ProviderPaymentStatus>;
}

export const BANK_CONNECTOR = Symbol('BANK_CONNECTOR');
