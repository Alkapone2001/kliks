import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { MERCHANT_QR_PAYLOAD_PATTERN } from '@kliks/shared';
import { CreatePaymentDto } from '../payments/payments.dto.js';

export class MerchantActorDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;
}
export class MerchantProfileDto extends MerchantActorDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  @Matches(/\S/)
  displayName!: string;
}
export class MerchantMemberDto extends MerchantActorDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  memberId!: string;
  @ApiProperty({ enum: ['MANAGER', 'VIEWER', 'REMOVE'] })
  @IsIn(['MANAGER', 'VIEWER', 'REMOVE'])
  role!: 'MANAGER' | 'VIEWER' | 'REMOVE';
}
export class MerchantQrDto extends PickType(CreatePaymentDto, [
  'amountMinor',
  'currency',
  'idempotencyKey',
] as const) {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;
}
export class MerchantRequestDto extends MerchantQrDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  payerId!: string;
}
export class MerchantCheckoutDto extends PickType(CreatePaymentDto, ['idempotencyKey'] as const) {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  payerId!: string;
  @ApiProperty({ description: 'Opaque static merchant reference only.' })
  @IsString()
  @Matches(MERCHANT_QR_PAYLOAD_PATTERN)
  payload!: string;
}
