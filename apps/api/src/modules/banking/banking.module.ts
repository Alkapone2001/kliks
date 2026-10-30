import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { BANK_CONNECTOR } from './bank-connector.js';
import { BankingController } from './banking.controller.js';
import { MockBankConnector } from './mock-bank-connector.js';
import { BankingService } from './banking.service.js';

@Module({
  imports: [AuditModule],
  controllers: [BankingController],
  providers: [
    MockBankConnector,
    BankingService,
    { provide: BANK_CONNECTOR, useExisting: MockBankConnector },
  ],
  exports: [BANK_CONNECTOR],
})
export class BankingModule {}
