import { Injectable } from '@nestjs/common';
import type { BankConnector, PaymentInitiationRequest } from './bank-connector.js';

@Injectable()
export class MockBankConnector implements BankConnector {
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
