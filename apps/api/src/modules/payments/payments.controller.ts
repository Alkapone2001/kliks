import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DevelopmentOnlyGuard } from '../identity/development-only.guard.js';
import { AuthorizePaymentDto, CreatePaymentDto } from './payments.dto.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('payments')
@Controller('payments')
@UseGuards(DevelopmentOnlyGuard)
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a simulated payment with a required payer-scoped idempotency key.',
  })
  @ApiCreatedResponse({ description: 'Payment waiting for simulated payer authorization.' })
  createPayment(@Body() body: CreatePaymentDto) {
    return this.payments.createPayment(body);
  }

  @Post(':paymentId/authorize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authorize or reject a simulated payment.' })
  @ApiOkResponse({ description: 'Updated simulated payment state.' })
  authorizePayment(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() body: AuthorizePaymentDto,
  ) {
    return this.payments.authorizePayment(paymentId, {
      payerId: body.payerId,
      decision: body.decision,
      outcome: body.outcome ?? 'SUCCESS',
    });
  }

  @Get()
  @ApiOperation({ summary: 'List simulated payments for a development identity.' })
  @ApiOkResponse({ description: 'Safe transaction history without bank references.' })
  listPayments(@Query('userId', ParseUUIDPipe) userId: string) {
    return this.payments.listPayments(userId);
  }
}
