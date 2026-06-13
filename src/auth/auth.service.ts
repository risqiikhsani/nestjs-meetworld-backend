import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './strategies/jwt.strategy';

export type SafeUser = {
  id: string;
  email: string;
  name: string;
};

const BCRYPT_COST = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: {
    email: string;
    password: string;
    name: string;
  }): Promise<{ access_token: string; user: SafeUser }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const createDto: CreateUserDto = {
      email: dto.email,
      name: dto.name,
      passwordHash,
    };
    const user = await this.usersService.create(createDto);

    return this.signAndShape(user);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.passwordHash === null) {
      return null;
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    return matches ? user : null;
  }

  async login(user: User): Promise<{ access_token: string; user: SafeUser }> {
    return this.signAndShape(user);
  }

  private async signAndShape(
    user: User,
  ): Promise<{ access_token: string; user: SafeUser }> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const access_token = await this.jwtService.signAsync(payload);
    return { access_token, user: this.toSafeUser(user) };
  }

  private toSafeUser(user: User): SafeUser {
    return { id: user.id, email: user.email, name: user.name };
  }
}
