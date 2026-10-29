import { Module } from '@nestjs/common';
import { BankingModule } from '../banking/banking.module.js';

@Module({ imports: [BankingModule] })
export class PaymentsModule {}
