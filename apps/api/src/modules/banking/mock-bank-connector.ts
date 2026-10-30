import { Injectable } from '@nestjs/common';
import type {
  BankConnector,
  MockAuthorizationDecision,
  PaymentInitiationRequest,
} from './bank-connector.js';

@Injectable()
export class MockBankConnector implements BankConnector {
  async connectAccount(request: { connectionId: string }) {
    return {
      providerAccountReference: `mock_account_${request.connectionId}`,
      displayName: 'Mock Bank Demo Account',
      status: 'PENDING_AUTHORIZATION' as const,
      simulation: true as const,
    };
  }

  async authorizeAccount(providerAccountReference: string, decision: MockAuthorizationDecision) {
    return {
      providerAccountReference,
      status: decision === 'APPROVE' ? ('CONNECTED' as const) : ('REJECTED' as const),
      simulation: true as const,
    };
  }

  async disconnectAccount(providerAccountReference: string) {
    return {
      providerAccountReference,
      status: 'DISCONNECTED' as const,
      simulation: true as const,
    };
  }

  async initiatePayment(request: PaymentInitiationRequest) {
    return {
      providerReference: `mock_${request.paymentId}`,
      status: 'PENDING' as const,
      simulation: true as const,
    };
  }

  async getPaymentStatus(providerReference: string) {
    return {
      providerReference,
      status: providerReference.startsWith('mock_') ? ('PENDING' as const) : ('NOT_FOUND' as const),
      simulation: true as const,
    };
  }
}
