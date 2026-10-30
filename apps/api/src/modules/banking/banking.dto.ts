import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import type { MockAuthorizationDecision } from './bank-connector.js';

export class UserAccountDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;
}

export class AuthorizeMockBankDto extends UserAccountDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsEnum(['APPROVE', 'REJECT'])
  decision!: MockAuthorizationDecision;
}
