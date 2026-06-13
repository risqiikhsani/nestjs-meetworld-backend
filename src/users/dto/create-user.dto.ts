import { IsEmail, IsString, Length } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @Length(1, 120)
  email!: string;

  @IsString()
  @Length(1, 80)
  name!: string;
}
