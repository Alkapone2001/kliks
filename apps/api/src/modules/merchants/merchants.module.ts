import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PaymentRequestsModule } from '../payment-requests/payment-requests.module.js';
import { QrPaymentsModule } from '../qr-payments/qr-payments.module.js';
import { DevelopmentOnlyGuard } from '../identity/development-only.guard.js';
import { MerchantsController } from './merchants.controller.js';
import { MerchantsService } from './merchants.service.js';

@Module({
  imports: [AuditModule, PaymentRequestsModule, QrPaymentsModule],
  controllers: [MerchantsController],
  providers: [MerchantsService, DevelopmentOnlyGuard],
})
export class MerchantsModule {}
