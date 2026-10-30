import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DevelopmentOnlyGuard } from '../identity/development-only.guard.js';
import { PaymentRequestsModule } from '../payment-requests/payment-requests.module.js';
import { SplitBillsController } from './split-bills.controller.js';
import { SplitBillsService } from './split-bills.service.js';

@Module({
  imports: [AuditModule, PaymentRequestsModule],
  controllers: [SplitBillsController],
  providers: [SplitBillsService, DevelopmentOnlyGuard],
})
export class SplitBillsModule {}
