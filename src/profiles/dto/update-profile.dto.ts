import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  bio?: string;

  @IsOptional()
  @IsUrl()
  @Length(1, 500)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  location?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
