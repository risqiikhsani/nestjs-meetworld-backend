import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  bio?: string;

  @ApiPropertyOptional({ format: 'uri', maxLength: 500 })
  @IsOptional()
  @IsUrl()
  @Length(1, 500)
  avatarUrl?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  location?: string;

  @ApiPropertyOptional({
    description: 'ISO-8601 date string (YYYY-MM-DD).',
    example: '1995-04-12',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
