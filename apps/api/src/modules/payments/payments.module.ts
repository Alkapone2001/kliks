import { Module } from '@nestjs/common';
import { BankingModule } from '../banking/banking.module';

@Module({ imports: [BankingModule] })
export class PaymentsModule {}
