import { ApiProperty, OmitType } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreatePaymentDto } from '../payments/payments.dto.js';

export class CreatePaymentRequestDto extends OmitType(CreatePaymentDto, ['payeeId'] as const) {
  @ApiProperty({ format: 'uuid', description: 'Development identity requesting the payment.' })
  @IsUUID()
  requesterId!: string;
}

export class PaymentRequestActorDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Acting development participant; not production authentication.',
  })
  @IsUUID()
  userId!: string;
}
