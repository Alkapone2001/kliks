import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import type { MockAuthorizationDecision, MockPaymentOutcome } from '../banking/bank-connector.js';

export class CreatePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  payerId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  payeeId!: string;

  @ApiProperty({ description: 'Positive integer amount in minor units.' })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor!: number;

  @ApiProperty({ enum: ['EUR'] })
  @IsString()
  @IsIn(['EUR'])
  currency!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  idempotencyKey!: string;
}

export class AuthorizePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  payerId!: string;

  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  decision!: MockAuthorizationDecision;

  @ApiPropertyOptional({ enum: ['SUCCESS', 'PENDING', 'INSUFFICIENT_FUNDS', 'PROVIDER_FAILURE'] })
  @IsOptional()
  @IsIn(['SUCCESS', 'PENDING', 'INSUFFICIENT_FUNDS', 'PROVIDER_FAILURE'])
  outcome?: MockPaymentOutcome;
}
