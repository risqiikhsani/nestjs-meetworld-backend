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

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const entity = this.usersRepository.create(dto);
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

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }
}
