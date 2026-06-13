import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Profile } from './entities/profile.entity';
import { ProfilesService } from './profiles.service';

type RepoMock = jest.Mocked<Pick<Repository<Profile>, 'findOneBy' | 'save'>>;

describe('ProfilesService', () => {
  let service: ProfilesService;
  let repo: RepoMock;
  let usersService: jest.Mocked<Pick<UsersService, 'findOne'>>;

  beforeEach(async () => {
    repo = {
      findOneBy: jest.fn(),
      save: jest.fn(),
    };

    usersService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: getRepositoryToken(Profile), useValue: repo },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(ProfilesService);
  });

  describe('findByUserId', () => {
    it('verifies the parent user exists then returns the profile', async () => {
      usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
      const profile = { id: 'p1', userId: 'u1' } as Profile;
      repo.findOneBy.mockResolvedValue(profile);

      await expect(service.findByUserId('u1')).resolves.toBe(profile);
      expect(usersService.findOne).toHaveBeenCalledWith('u1');
      expect(repo.findOneBy).toHaveBeenCalledWith({ userId: 'u1' });
    });

    it('throws ResourceNotFoundException when the user is missing', async () => {
      usersService.findOne.mockRejectedValue(
        new ResourceNotFoundException('User', 'nope'),
      );

      await expect(service.findByUserId('nope')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repo.findOneBy).not.toHaveBeenCalled();
    });

    it('throws ResourceNotFoundException when the profile is missing', async () => {
      usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findByUserId('u1')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe('update', () => {
    it('merges the dto into the existing profile and saves', async () => {
      const profile = {
        id: 'p1',
        userId: 'u1',
        bio: null,
        avatarUrl: null,
        location: null,
        dateOfBirth: null,
      } as Profile;
      usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
      repo.findOneBy.mockResolvedValue(profile);
      const saved = { ...profile, bio: 'hello' };
      repo.save.mockResolvedValue(saved);

      const dto: UpdateProfileDto = { bio: 'hello' };
      await expect(service.update('u1', dto)).resolves.toBe(saved);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ bio: 'hello' }),
      );
    });

    it('throws when the user does not exist', async () => {
      usersService.findOne.mockRejectedValue(
        new ResourceNotFoundException('User', 'nope'),
      );

      await expect(service.update('nope', { bio: 'x' })).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
