import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { SplitMode } from '@kliks/shared';
import { CreatePaymentDto } from '../payments/payments.dto.js';

export class SplitBillParticipantDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({ description: 'Required only for CUSTOM mode, in EUR minor units.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor?: number;
}

export class CreateSplitBillDto extends PickType(CreatePaymentDto, [
  'currency',
  'idempotencyKey',
] as const) {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  creatorId!: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @Matches(/\S/)
  @MaxLength(80)
  title!: string;

  @ApiProperty({
    description: 'Positive total in integer EUR minor units, including the creator share.',
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  totalMinor!: number;

  @ApiProperty({ enum: ['EQUAL', 'CUSTOM'] })
  @IsIn(['EQUAL', 'CUSTOM'])
  mode!: SplitMode;

  @ApiProperty({
    type: [SplitBillParticipantDto],
    description: '2 to 20 distinct participants, including the creator.',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SplitBillParticipantDto)
  participants!: SplitBillParticipantDto[];
}

export class CancelSplitBillDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;
}
