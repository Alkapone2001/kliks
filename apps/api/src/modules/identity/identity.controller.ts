import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiAcceptedResponse, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DevelopmentOnlyGuard } from './development-only.guard.js';
import { ConfirmPhoneVerificationDto, CreateIdentityDto } from './identity.dto.js';
import { IdentityService } from './identity.service.js';

@ApiTags('identity')
@Controller('identity')
@UseGuards(DevelopmentOnlyGuard)
export class IdentityController {
  constructor(@Inject(IdentityService) private readonly identityService: IdentityService) {}

  @Post('users')
  @ApiOperation({ summary: 'Create a development identity; private phone data is never returned.' })
  @ApiCreatedResponse({ description: 'Safe identity preview.' })
  createIdentity(@Body() body: CreateIdentityDto) {
    return this.identityService.createIdentity(body);
  }

  @Post('users/:userId/phone-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start a simulated phone verification; no SMS is sent.' })
  @ApiAcceptedResponse({ description: 'Development code and expiry, marked as simulation.' })
  startPhoneVerification(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.identityService.startPhoneVerification(userId);
  }

  @Post('users/:userId/phone-verification/confirm')
  @ApiOperation({ summary: 'Confirm a development-only simulated phone verification.' })
  @ApiCreatedResponse({ description: 'Safe identity preview with verified status.' })
  confirmPhoneVerification(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: ConfirmPhoneVerificationDto,
  ) {
    return this.identityService.confirmPhoneVerification(userId, body.challengeId, body.code);
  }
}
