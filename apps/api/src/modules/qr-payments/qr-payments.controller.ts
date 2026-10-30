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
import { CreateQrPaymentDto, PayQrPaymentDto, ResolveQrPaymentDto } from './qr-payments.dto.js';
import { QrPaymentsService } from './qr-payments.service.js';

@ApiTags('qr-payments')
@Controller('qr-payments')
@UseGuards(DevelopmentOnlyGuard)
export class QrPaymentsController {
  constructor(@Inject(QrPaymentsService) private readonly qr: QrPaymentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Generate a single-use 15-minute simulated payment QR with an opaque payload.',
  })
  create(@Body() body: CreateQrPaymentDto) {
    return this.qr.create(body);
  }

  @Get()
  @ApiOperation({ summary: "List the development owner's QR sessions and expiry/use status." })
  list(@Query('userId', ParseUUIDPipe) userId: string) {
    return this.qr.list(userId);
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'View a QR image as its development owner.' })
  get(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.qr.get(sessionId, userId);
  }

  @Post('resolve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resolve a scanned payload server-side without consuming it.' })
  resolve(@Body() body: ResolveQrPaymentDto) {
    return this.qr.resolve(body.payload, body.payerId);
  }

  @Post('pay')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirm recipient/amount and consume the QR once; authorization remains separate.',
  })
  pay(@Body() body: PayQrPaymentDto) {
    return this.qr.pay(body.payload, body.payerId, body.amountMinor);
  }
}
