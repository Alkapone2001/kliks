import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const adminKinds = [
  'users',
  'accounts',
  'payments',
  'requests',
  'merchants',
  'bills',
  'qr',
  'audit',
] as const;
export type AdminKind = (typeof adminKinds)[number];
export const adminActions = [
  'directory',
  'connect-account',
  'approve-account',
  'reject-account',
  'default-account',
  'disconnect-account',
  'cancel-request',
  'reject-request',
  'cancel-bill',
  'rename-merchant',
  'merchant-member',
] as const;
export type AdminAction = (typeof adminActions)[number];

export class AdminQueryDto {
  @ApiProperty({ enum: adminKinds })
  @IsIn(adminKinds)
  kind!: AdminKind;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cursor?: string;
  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  q?: string;
}
export class AdminActionDto {
  @ApiProperty({ enum: adminActions })
  @IsIn(adminActions)
  action!: AdminAction;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
  @IsOptional()
  @IsUUID()
  memberId?: string;
  @IsOptional()
  @IsIn(['MANAGER', 'VIEWER', 'REMOVE'])
  role?: 'MANAGER' | 'VIEWER' | 'REMOVE';
}
