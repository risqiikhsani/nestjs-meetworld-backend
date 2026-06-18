import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'alice@example.com',
    format: 'email',
    maxLength: 120,
  })
  @IsEmail()
  @Length(1, 120)
  email!: string;

  @ApiProperty({
    example: 'correct-horse-battery-staple',
    description: 'Plaintext password; bcrypt-hashed server-side at cost 12.',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Alice', minLength: 1, maxLength: 80 })
  @IsString()
  @Length(1, 80)
  name!: string;
}
