import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { Profile } from '../profiles/entities/profile.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Profile)
    private readonly profilesRepository: Repository<Profile>,
    private readonly dataSource: DataSource,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find({ order: { createdAt: 'DESC' } });
  }

  // `passwordHash` is declared with `select: false`, so it must be opted into
  // explicitly here. Without this, `bcrypt.compare` runs against `undefined`
  // and throws "data and hash arguments required".
  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      select: ['id', 'email', 'name', 'passwordHash'],
    });
  }

  // Loads a user with `passwordHash` selected. Used by AuthService to verify
  // the current password before rotation. Returns null (not throw) on miss
  // so the auth layer can decide how to map "not found" to a response.
  findOneWithPasswordHash(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      select: ['id', 'passwordHash'],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }
    return user;
  }

  // `passwordHash` is the *already-bcrypted* value. Hashing is owned by
  // `AuthService` (the only place that imports `bcrypt`); this service just
  // persists what's handed to it. `CreateUserDto` and `UpdateUserDto` don't
  // expose `passwordHash`, so the global `ValidationPipe` rejects/forbids
  // any inbound `passwordHash` on the user routes.
  async create(dto: CreateUserDto, passwordHash?: string): Promise<User> {
    const entity = this.usersRepository.create(dto);
    if (passwordHash !== undefined) {
      entity.passwordHash = passwordHash;
    }
    return this.usersRepository.save(entity);
  }

  // `avatarUrl` is mirrored to the related profile inside the same transaction
  // so the two columns stay in sync. We write the profile directly via the
  // entity manager — never through ProfilesService — to avoid a re-entrant
  // call back into this method.
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOneBy(User, { id });
      if (!user) {
        throw new ResourceNotFoundException('User', id);
      }

      Object.assign(user, dto);
      const saved = await manager.save(user);

      if (dto.avatarUrl !== undefined) {
        const profile = await manager.findOneBy(Profile, { userId: id });
        if (profile) {
          if (profile.avatarUrl !== dto.avatarUrl) {
            profile.avatarUrl = dto.avatarUrl;
            await manager.save(profile);
          }
        } else {
          await manager.save(
            manager.create(Profile, { userId: id, avatarUrl: dto.avatarUrl }),
          );
        }
      }

      return saved;
    });
  }

  // Persists a pre-hashed password. The hash is computed by the caller
  // (AuthService) — this method never sees plaintext. Used both for the
  // initial password at register time and for rotation via PATCH /auth/password.
  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.usersRepository.update(id, { passwordHash });
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }
}
