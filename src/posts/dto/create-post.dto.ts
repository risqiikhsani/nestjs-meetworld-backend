import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: 'Hello, world', minLength: 1, maxLength: 200 })
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiProperty({
    example: 'First post on MeetWorld.',
    minLength: 1,
    maxLength: 10000,
  })
  @IsString()
  @Length(1, 10000)
  body!: string;
}
