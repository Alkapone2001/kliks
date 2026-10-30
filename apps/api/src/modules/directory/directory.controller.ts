import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DevelopmentOnlyGuard } from '../identity/development-only.guard.js';
import { DirectoryRateLimitGuard } from './directory-rate-limit.guard.js';
import {
  ResolvePhoneDto,
  ResolveUsernameDto,
  UpdateDirectoryVisibilityDto,
} from './directory.dto.js';
import { DirectoryService } from './directory.service.js';

@ApiTags('directory')
@Controller('directory')
@UseGuards(DevelopmentOnlyGuard, DirectoryRateLimitGuard)
export class DirectoryController {
  constructor(@Inject(DirectoryService) private readonly directory: DirectoryService) {}

  @Post('visibility')
  @ApiOperation({
    summary: 'Opt a verified development identity in or out of recipient discovery.',
  })
  @ApiOkResponse({ description: 'Updated directory visibility preference.' })
  setVisibility(@Body() body: UpdateDirectoryVisibilityDto) {
    return this.directory.setVisibility(body.userId, body.enabled);
  }

  @Post('resolve/phone')
  @ApiOperation({ summary: 'Resolve a phone number to a safe, opted-in recipient preview.' })
  @ApiOkResponse({ description: 'Safe recipient preview without phone or account details.' })
  @ApiNotFoundResponse({ description: 'Recipient not found or not publicly discoverable.' })
  resolveByPhone(@Body() body: ResolvePhoneDto) {
    return this.directory.resolveByPhone(body.phoneNumber);
  }

  @Post('resolve/username')
  @ApiOperation({ summary: 'Resolve a username to a safe, opted-in recipient preview.' })
  @ApiOkResponse({ description: 'Safe recipient preview without phone or account details.' })
  @ApiNotFoundResponse({ description: 'Recipient not found or not publicly discoverable.' })
  resolveByUsername(@Body() body: ResolveUsernameDto) {
    return this.directory.resolveByUsername(body.username);
  }
}
