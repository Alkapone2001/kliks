import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DevelopmentOnlyGuard } from '../identity/development-only.guard.js';
import { DirectoryController } from './directory.controller.js';
import { DirectoryRateLimitGuard } from './directory-rate-limit.guard.js';
import { DirectoryService } from './directory.service.js';

@Module({
  imports: [AuditModule],
  controllers: [DirectoryController],
  providers: [DirectoryService, DevelopmentOnlyGuard, DirectoryRateLimitGuard],
})
export class DirectoryModule {}
