import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @ApiProperty({
    description:
      'Current plaintext password. Verified against the stored bcrypt hash before the change is applied.',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({
    description:
      'New plaintext password. Bcrypt-hashed server-side at cost 12 before being persisted.',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
