import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Profile } from './entities/profile.entity';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profilesRepository: Repository<Profile>,
    private readonly usersService: UsersService,
  ) {}

  async findByUserId(userId: string): Promise<Profile> {
    await this.usersService.findOne(userId);
    const profile = await this.profilesRepository.findOneBy({ userId });
    if (!profile) {
      throw new ResourceNotFoundException('Profile', userId);
    }
    return profile;
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    const profile = await this.findByUserId(userId);
    Object.assign(profile, dto);
    return this.profilesRepository.save(profile);
  }
}
