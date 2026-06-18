import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'Unique email address (used as the login identifier).',
    example: 'alice@example.com',
    format: 'email',
    maxLength: 120,
  })
  @IsEmail()
  @Length(1, 120)
  email!: string;

  @ApiProperty({ example: 'Alice', minLength: 1, maxLength: 80 })
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiPropertyOptional({
    description:
      'bcrypt hash. Server-managed — direct callers should not set this. ' +
      'New users are created via `POST /api/auth/register`.',
    minLength: 60,
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @Length(60, 60)
  passwordHash?: string;
}
