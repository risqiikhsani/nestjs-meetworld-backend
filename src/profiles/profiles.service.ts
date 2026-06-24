import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Profile } from './entities/profile.entity';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profilesRepository: Repository<Profile>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  async findByUserId(userId: string): Promise<Profile> {
    await this.usersService.findOne(userId);
    const profile = await this.profilesRepository.findOneBy({ userId });
    if (!profile) {
      throw new ResourceNotFoundException('Profile', userId);
    }
    return profile;
  }

  // `avatarUrl` is mirrored to the parent user inside the same transaction
  // so the two columns stay in sync. We write the user directly via the
  // entity manager — never through UsersService — to avoid a re-entrant
  // call back into this method.
  async update(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOneBy(User, { id: userId });
      if (!user) {
        throw new ResourceNotFoundException('User', userId);
      }

      const profile = await manager.findOneBy(Profile, { userId });
      if (!profile) {
        throw new ResourceNotFoundException('Profile', userId);
      }

      Object.assign(profile, dto);
      const saved = await manager.save(profile);

      if (dto.avatarUrl !== undefined && user.avatarUrl !== dto.avatarUrl) {
        user.avatarUrl = dto.avatarUrl;
        await manager.save(user);
      }

      return saved;
    });
  }
}
