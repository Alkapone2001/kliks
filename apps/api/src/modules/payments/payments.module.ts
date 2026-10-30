import { Module } from '@nestjs/common';
import { BankingModule } from '../banking/banking.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { DevelopmentOnlyGuard } from '../identity/development-only.guard.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [BankingModule, AuditModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, DevelopmentOnlyGuard],
})
export class PaymentsModule {}
