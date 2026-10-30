import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DevelopmentOnlyGuard } from '../identity/development-only.guard.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { PaymentRequestsController } from './payment-requests.controller.js';
import { PaymentRequestsService } from './payment-requests.service.js';

@Module({
  imports: [PaymentsModule, AuditModule],
  controllers: [PaymentRequestsController],
  providers: [PaymentRequestsService, DevelopmentOnlyGuard],
  exports: [PaymentRequestsService],
})
export class PaymentRequestsModule {}
