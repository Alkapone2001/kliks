import { Module } from '@nestjs/common';
import { AuditModule } from './modules/audit/audit.module';
import { BankingModule } from './modules/banking/banking.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { IdentityModule } from './modules/identity/identity.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { HealthController } from './health.controller';

@Module({
  imports: [IdentityModule, DirectoryModule, BankingModule, PaymentsModule, AuditModule],
  controllers: [HealthController],
})
export class AppModule {}
