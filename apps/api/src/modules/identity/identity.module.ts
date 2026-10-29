import { Module } from '@nestjs/common';
import { DevelopmentOnlyGuard } from './development-only.guard.js';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';

@Module({
  controllers: [IdentityController],
  providers: [IdentityService, DevelopmentOnlyGuard],
})
export class IdentityModule {}
