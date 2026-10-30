import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DevelopmentOnlyGuard } from '../identity/development-only.guard.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { QrPaymentsController } from './qr-payments.controller.js';
import { QrPaymentsService } from './qr-payments.service.js';

@Module({
  imports: [AuditModule, PaymentsModule],
  controllers: [QrPaymentsController],
  providers: [QrPaymentsService, DevelopmentOnlyGuard],
  exports: [QrPaymentsService],
})
export class QrPaymentsModule {}
