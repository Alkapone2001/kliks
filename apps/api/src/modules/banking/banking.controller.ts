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
import { AuthorizeMockBankDto, UserAccountDto } from './banking.dto.js';
import { BankingService } from './banking.service.js';

@ApiTags('banking')
@Controller('banking/accounts')
@UseGuards(DevelopmentOnlyGuard)
export class BankingController {
  constructor(@Inject(BankingService) private readonly bankingService: BankingService) {}

  @Post()
  @ApiOperation({ summary: 'Start a Mock Bank account connection; this is simulated.' })
  @ApiCreatedResponse({ description: 'Pending simulated linked-account connection.' })
  connectAccount(@Body() body: UserAccountDto) {
    return this.bankingService.connectAccount(body.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List safe linked-account details for a development identity.' })
  @ApiOkResponse({
    description: 'Safe account display and connection status; no provider reference.',
  })
  listAccounts(@Query('userId', ParseUUIDPipe) userId: string) {
    return this.bankingService.listAccounts(userId);
  }

  @Post(':accountId/authorize')
  @ApiOperation({ summary: 'Simulate Mock Bank authorization or rejection.' })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Updated simulated connection state.' })
  authorizeAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() body: AuthorizeMockBankDto,
  ) {
    return this.bankingService.authorizeAccount(body.userId, accountId, body.decision);
  }

  @Post(':accountId/default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Select a connected Mock Bank account as the default.' })
  @ApiOkResponse({ description: 'Updated safe linked-account details.' })
  setDefaultAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() body: UserAccountDto,
  ) {
    return this.bankingService.setDefaultAccount(body.userId, accountId);
  }

  @Post(':accountId/disconnect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect a Mock Bank account; this is simulated.' })
  @ApiOkResponse({ description: 'Disconnected safe linked-account details.' })
  disconnectAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() body: UserAccountDto,
  ) {
    return this.bankingService.disconnectAccount(body.userId, accountId);
  }
}
