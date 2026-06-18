import { ApiProperty } from '@nestjs/swagger';

export class SafeUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'alice@example.com' })
  email!: string;

  @ApiProperty({ example: 'Alice' })
  name!: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description:
      'Signed JWT. Paste into the Authorize dialog as `Bearer <token>`.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token!: string;

  @ApiProperty({ type: SafeUserDto })
  user!: SafeUserDto;
}
