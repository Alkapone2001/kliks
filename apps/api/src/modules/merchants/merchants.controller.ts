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
import {
  MerchantActorDto,
  MerchantCheckoutDto,
  MerchantMemberDto,
  MerchantProfileDto,
  MerchantQrDto,
  MerchantRequestDto,
} from './merchants.dto.js';
import { MerchantsService } from './merchants.service.js';

@ApiTags('merchants')
@Controller('merchants')
@UseGuards(DevelopmentOnlyGuard)
export class MerchantsController {
  constructor(@Inject(MerchantsService) private readonly merchants: MerchantsService) {}
  @Post()
  @ApiOperation({
    summary: 'Create one development merchant profile per verified/discoverable owner.',
  })
  create(@Body() body: MerchantProfileDto) {
    return this.merchants.create(body.userId, body.displayName);
  }
  @Get()
  list(@Query('userId', ParseUUIDPipe) userId: string) {
    return this.merchants.list(userId);
  }
  @Get(':merchantId')
  get(
    @Param('merchantId', ParseUUIDPipe) id: string,
    @Query('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.merchants.get(id, userId);
  }
  @Post(':merchantId/profile')
  @HttpCode(200)
  update(@Param('merchantId', ParseUUIDPipe) id: string, @Body() body: MerchantProfileDto) {
    return this.merchants.update(id, body.userId, body.displayName);
  }
  @Post(':merchantId/members')
  @HttpCode(200)
  member(@Param('merchantId', ParseUUIDPipe) id: string, @Body() body: MerchantMemberDto) {
    return this.merchants.member(id, body.userId, body.memberId, body.role);
  }
  @Get(':merchantId/static-qr')
  @ApiOperation({
    summary: 'Show a reusable merchant reference; each customer opens a fresh single-use checkout.',
  })
  staticQr(
    @Param('merchantId', ParseUUIDPipe) id: string,
    @Query('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.merchants.staticQr(id, userId);
  }
  @Post(':merchantId/qr')
  @ApiOperation({
    summary: 'Owner/manager creates an attributed fixed-amount single-use dynamic QR.',
  })
  dynamicQr(@Param('merchantId', ParseUUIDPipe) id: string, @Body() body: MerchantQrDto) {
    return this.merchants.dynamicQr(
      id,
      body.userId,
      body.amountMinor,
      body.currency,
      body.idempotencyKey,
    );
  }
  @Post(':merchantId/requests')
  request(@Param('merchantId', ParseUUIDPipe) id: string, @Body() body: MerchantRequestDto) {
    return this.merchants.request(
      id,
      body.userId,
      body.payerId,
      body.amountMinor,
      body.currency,
      body.idempotencyKey,
    );
  }
  @Post(':merchantId/requests/:requestId/cancel')
  @HttpCode(200)
  cancel(
    @Param('merchantId', ParseUUIDPipe) id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() body: MerchantActorDto,
  ) {
    return this.merchants.cancelRequest(id, body.userId, requestId);
  }
  @Get(':merchantId/history')
  history(
    @Param('merchantId', ParseUUIDPipe) id: string,
    @Query('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.merchants.history(id, userId);
  }
  @Post('checkout')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Resolve a static merchant QR into an idempotent 15-minute checkout; never initiates a payment.',
  })
  checkout(@Body() body: MerchantCheckoutDto) {
    return this.merchants.checkout(body.payload, body.payerId, body.idempotencyKey);
  }
}
