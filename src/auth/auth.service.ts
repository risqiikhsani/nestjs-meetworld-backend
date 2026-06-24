import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
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

    // Hashing is owned here — `UsersService` only sees the bcrypt output.
    // `CreateUserDto` no longer carries `passwordHash`, so there is no
    // public path that writes the column directly.
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.usersService.create(
      { email: dto.email, name: dto.name },
      passwordHash,
    );

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

  // Verify the caller's current password, then rotate to a fresh bcrypt hash.
  // `UsersService` does the data access; this service owns the crypto and the
  // caller's view of correctness (401 on wrong current password, 401 on
  // passwordless legacy users, 404 on missing user).
  async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findOneWithPasswordHash(userId);
    if (!user) {
      throw new ResourceNotFoundException('User', userId);
    }
    if (user.passwordHash === null) {
      throw new UnauthorizedException(
        'No password is set for this user; contact an administrator',
      );
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await this.usersService.setPasswordHash(userId, newHash);
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
