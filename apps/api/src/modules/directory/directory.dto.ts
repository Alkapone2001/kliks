import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ResolvePhoneDto {
  @ApiProperty({ description: 'Kosovo phone number; normalized to E.164 before matching.' })
  @IsString()
  @MinLength(5)
  @MaxLength(32)
  phoneNumber!: string;
}

export class ResolveUsernameDto {
  @ApiProperty({ description: 'Username; matching is ASCII case-insensitive.' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username!: string;
}

export class UpdateDirectoryVisibilityDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Whether the verified identity can be found through the directory.' })
  @IsBoolean()
  enabled!: boolean;
}
