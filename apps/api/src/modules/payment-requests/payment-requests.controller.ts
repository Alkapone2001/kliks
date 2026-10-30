import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DevelopmentOnlyGuard } from '../identity/development-only.guard.js';
import { CreatePaymentRequestDto, PaymentRequestActorDto } from './payment-requests.dto.js';
import { PaymentRequestsService } from './payment-requests.service.js';

@ApiTags('payment-requests')
@Controller('payment-requests')
@UseGuards(DevelopmentOnlyGuard)
export class PaymentRequestsController {
  constructor(@Inject(PaymentRequestsService) private readonly requests: PaymentRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a development-only simulated payment request.' })
  create(@Body() body: CreatePaymentRequestDto) {
    return this.requests.create(body);
  }

  @Get()
  @ApiOperation({
    summary: 'List requests for a development participant, with live linked payment status.',
  })
  list(@Query('userId', ParseUUIDPipe) userId: string) {
    return this.requests.list(userId);
  }

  @Get(':requestId')
  @ApiOperation({ summary: 'View a request as a development participant.' })
  get(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Query('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.requests.get(requestId, userId);
  }

  @Post(':requestId/accept')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Payer accepts once, atomically creating one simulated payment awaiting authorization.',
  })
  accept(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() body: PaymentRequestActorDto,
  ) {
    return this.requests.accept(requestId, body.userId);
  }

  @Post(':requestId/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Payer rejects a pending request.' })
  reject(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() body: PaymentRequestActorDto,
  ) {
    return this.requests.reject(requestId, body.userId);
  }

  @Post(':requestId/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Requester cancels a pending request.' })
  cancel(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() body: PaymentRequestActorDto,
  ) {
    return this.requests.cancel(requestId, body.userId);
  }
}
