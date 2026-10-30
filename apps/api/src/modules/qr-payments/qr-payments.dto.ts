import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { QR_PAYMENT_PAYLOAD_PATTERN } from '@kliks/shared';
import { CreatePaymentDto } from '../payments/payments.dto.js';

export class CreateQrPaymentDto extends OmitType(CreatePaymentDto, [
  'payerId',
  'payeeId',
  'amountMinor',
] as const) {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ownerId!: string;

  @ApiPropertyOptional({ description: 'Optional positive EUR amount in integer minor units.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor?: number;
}

export class ResolveQrPaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  payerId!: string;

  @ApiProperty({ description: 'Opaque kliks:pay:v1 session reference only.' })
  @IsString()
  @MaxLength(100)
  @Matches(QR_PAYMENT_PAYLOAD_PATTERN)
  payload!: string;
}

export class PayQrPaymentDto extends ResolveQrPaymentDto {
  @ApiProperty({ description: 'Confirmed positive EUR amount in integer minor units.' })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor!: number;
}
