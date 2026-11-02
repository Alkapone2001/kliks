import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { BankingModule } from '../banking/banking.module.js';
import { DirectoryModule } from '../directory/directory.module.js';
import { PaymentRequestsModule } from '../payment-requests/payment-requests.module.js';
import { SplitBillsModule } from '../split-bills/split-bills.module.js';
import { MerchantsModule } from '../merchants/merchants.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { DemoAdminGuard } from './admin.guard.js';

@Module({
  imports: [
    AuditModule,
    BankingModule,
    DirectoryModule,
    PaymentRequestsModule,
    SplitBillsModule,
    MerchantsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, DemoAdminGuard],
})
export class AdminModule {}
