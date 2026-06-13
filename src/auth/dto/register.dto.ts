import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @Length(1, 120)
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @Length(1, 80)
  name!: string;
}
