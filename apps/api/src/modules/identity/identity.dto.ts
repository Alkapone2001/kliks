import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateIdentityDto {
  @ApiProperty({ description: 'Kosovo phone number; normalized to E.164 before storage.' })
  @IsString()
  @MinLength(5)
  @MaxLength(32)
  phoneNumber!: string;

  @ApiProperty({ description: '3-30 ASCII letters, numbers, or underscores.' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username!: string;
}

export class ConfirmPhoneVerificationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ pattern: '^\\d{6}$' })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
