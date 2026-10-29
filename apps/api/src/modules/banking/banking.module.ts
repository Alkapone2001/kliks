import { Module } from '@nestjs/common';
import { BANK_CONNECTOR } from './bank-connector.js';
import { MockBankConnector } from './mock-bank-connector.js';

@Module({
  providers: [MockBankConnector, { provide: BANK_CONNECTOR, useExisting: MockBankConnector }],
  exports: [BANK_CONNECTOR],
})
export class BankingModule {}
