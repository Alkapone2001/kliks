import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DemoAdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';
import { AdminActionDto, AdminQueryDto } from './admin.dto.js';

@ApiTags('demo-admin')
@Controller('admin')
@UseGuards(DemoAdminGuard)
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}
  @Get('overview')
  overview() {
    return this.admin.overview();
  }
  @Get('records')
  records(@Query() query: AdminQueryDto) {
    return this.admin.records(query);
  }
  @Post('actions')
  action(@Body() body: AdminActionDto) {
    return this.admin.action(body);
  }
}
