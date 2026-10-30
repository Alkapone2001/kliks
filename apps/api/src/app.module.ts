import { Module } from '@nestjs/common';
import { AuditModule } from './modules/audit/audit.module.js';
import { BankingModule } from './modules/banking/banking.module.js';
import { DirectoryModule } from './modules/directory/directory.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { PaymentRequestsModule } from './modules/payment-requests/payment-requests.module.js';
import { QrPaymentsModule } from './modules/qr-payments/qr-payments.module.js';
import { SplitBillsModule } from './modules/split-bills/split-bills.module.js';
import { MerchantsModule } from './modules/merchants/merchants.module.js';
import { HealthController } from './health.controller.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    DirectoryModule,
    BankingModule,
    PaymentsModule,
    PaymentRequestsModule,
    QrPaymentsModule,
    SplitBillsModule,
    MerchantsModule,
    AuditModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
