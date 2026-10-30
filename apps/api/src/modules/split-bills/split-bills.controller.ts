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
import { CancelSplitBillDto, CreateSplitBillDto } from './split-bills.dto.js';
import { SplitBillsService } from './split-bills.service.js';

@ApiTags('split-bills')
@Controller('split-bills')
@UseGuards(DevelopmentOnlyGuard)
export class SplitBillsController {
  constructor(@Inject(SplitBillsService) private readonly bills: SplitBillsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a simulated equal/custom bill and its participant requests atomically.',
  })
  create(@Body() body: CreateSplitBillDto) {
    return this.bills.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'List bills for a development participant with live share status.' })
  list(@Query('userId', ParseUUIDPipe) userId: string) {
    return this.bills.list(userId);
  }

  @Get(':billId')
  @ApiOperation({ summary: 'View a bill as one of its participants.' })
  get(
    @Param('billId', ParseUUIDPipe) billId: string,
    @Query('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.bills.get(billId, userId);
  }

  @Post(':billId/cancel')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Creator cancels a bill and pending requests before any share is accepted.',
  })
  cancel(@Param('billId', ParseUUIDPipe) billId: string, @Body() body: CancelSplitBillDto) {
    return this.bills.cancel(billId, body.userId);
  }
}
