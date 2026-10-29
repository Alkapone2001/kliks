import { Module } from '@nestjs/common';
import { BANK_CONNECTOR } from './bank-connector';
import { MockBankConnector } from './mock-bank-connector';

@Module({
  providers: [MockBankConnector, { provide: BANK_CONNECTOR, useExisting: MockBankConnector }],
  exports: [BANK_CONNECTOR],
})
export class BankingModule {}