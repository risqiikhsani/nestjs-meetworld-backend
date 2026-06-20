import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    example: 'My comment on this post',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  text!: string;
}
