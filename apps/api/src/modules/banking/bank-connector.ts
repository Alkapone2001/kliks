import type { Money } from '@kliks/shared';

export interface PaymentInitiationRequest {
  paymentId: string;
  destinationReference: string;
  amount: Money;
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
  initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResult>;
  getPaymentStatus(providerReference: string): Promise<ProviderPaymentStatus>;
}

export const BANK_CONNECTOR = Symbol('BANK_CONNECTOR');
