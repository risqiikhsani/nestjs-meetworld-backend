import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Profile } from './entities/profile.entity';
import { ProfilesService } from './profiles.service';

type RepoMock = jest.Mocked<Pick<Repository<Profile>, 'findOneBy' | 'save'>>;
type UserRepoMock = jest.Mocked<Pick<Repository<User>, never>>;
type Manager = Pick<EntityManager, 'findOneBy' | 'save'>;

describe('ProfilesService', () => {
  let service: ProfilesService;
  let repo: RepoMock;
  let userRepo: UserRepoMock;
  let usersService: jest.Mocked<Pick<UsersService, 'findOne'>>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    repo = {
      findOneBy: jest.fn(),
      save: jest.fn(),
    };

    userRepo = {};

    usersService = {
      findOne: jest.fn(),
    };

    // `update` runs inside `dataSource.transaction`. The mock invokes the
    // callback with a manager that forwards to the profile repository
    // mock so the existing `repo.*` assertions still observe the right
    // calls. User lookups return a stub so the avatar-sync branch can
    // run; the user's `avatarUrl` is null so any dto.avatarUrl triggers
    // the save-on-user path.
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation((cb: (m: Manager) => Promise<unknown>) => {
          const manager = {
            findOneBy: jest
              .fn()
              .mockImplementation(
                (
                  Entity: unknown,
                  opts: Parameters<typeof repo.findOneBy>[0],
                ) => {
                  if (Entity === Profile) {
                    return Promise.resolve(repo.findOneBy(opts));
                  }
                  if (Entity === User) {
                    return Promise.resolve({
                      id: (opts as { id: string }).id,
                      avatarUrl: null,
                    } as User);
                  }
                  return Promise.resolve(null);
                },
              ),
            save: jest
              .fn()
              .mockImplementation((entity: Parameters<typeof repo.save>[0]) =>
                repo.save(entity),
              ),
          } as unknown as Manager;
          return cb(manager);
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: getRepositoryToken(Profile), useValue: repo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: UsersService, useValue: usersService },
        { provide: DataSource, useValue: dataSource },
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
      repo.findOneBy.mockResolvedValue(profile);
      const saved = { ...profile, bio: 'hello' };
      repo.save.mockResolvedValue(saved);

      const dto: UpdateProfileDto = { bio: 'hello' };
      await expect(service.update('u1', dto)).resolves.toBe(saved);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ bio: 'hello' }),
      );
      // The user row is not touched when avatarUrl is unchanged.
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('mirrors avatarUrl to the parent user inside the same transaction', async () => {
      const profile = {
        id: 'p1',
        userId: 'u1',
        bio: null,
        avatarUrl: null,
      } as Profile;
      repo.findOneBy.mockResolvedValue(profile);
      // The user stubbed in the dataSource mock has avatarUrl = null,
      // so any non-undefined dto.avatarUrl triggers the save-on-user path.
      repo.save.mockImplementation((entity) => Promise.resolve(entity));

      const dto: UpdateProfileDto = { avatarUrl: 'https://cdn/u1.png' };
      await expect(service.update('u1', dto)).resolves.toMatchObject({
        avatarUrl: 'https://cdn/u1.png',
      });
      // Two saves: one for the profile, one for the mirrored user row.
      expect(repo.save).toHaveBeenCalledTimes(2);
      expect(repo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ avatarUrl: 'https://cdn/u1.png' }),
      );
    });

    it('skips the user save when avatarUrl is unchanged', async () => {
      const profile = {
        id: 'p1',
        userId: 'u1',
        bio: null,
        avatarUrl: 'https://cdn/u1.png',
      } as Profile;
      // The manager's findOneBy(User, ...) stub returns avatarUrl: null by
      // default, so to test the "no-op when avatarUrl already matches" path
      // we forward the user's avatarUrl through the manager mock.
      dataSource.transaction.mockImplementationOnce(
        (cb: (m: Manager) => Promise<unknown>) => {
          const manager = {
            findOneBy: jest
              .fn()
              .mockImplementation((Entity: unknown, opts: unknown) => {
                if (Entity === Profile) {
                  return Promise.resolve(repo.findOneBy(opts as never));
                }
                if (Entity === User) {
                  return Promise.resolve({
                    id: (opts as { id: string }).id,
                    avatarUrl: 'https://cdn/u1.png',
                  } as User);
                }
                return Promise.resolve(null);
              }),
            save: jest
              .fn()
              .mockImplementation((entity: Parameters<typeof repo.save>[0]) =>
                repo.save(entity),
              ),
          } as unknown as Manager;
          return cb(manager);
        },
      );
      repo.findOneBy.mockResolvedValue(profile);
      repo.save.mockResolvedValue(profile);

      const dto: UpdateProfileDto = { avatarUrl: 'https://cdn/u1.png' };
      await expect(service.update('u1', dto)).resolves.toBe(profile);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('throws when the user does not exist', async () => {
      // Override the manager's findOneBy(User, ...) to return null.
      dataSource.transaction.mockImplementationOnce(
        (cb: (m: Manager) => Promise<unknown>) => {
          const manager = {
            findOneBy: jest
              .fn()
              .mockImplementation((Entity: unknown, opts: unknown) => {
                if (Entity === User) return Promise.resolve(null);
                if (Entity === Profile) {
                  return Promise.resolve(repo.findOneBy(opts as never));
                }
                return Promise.resolve(null);
              }),
            save: jest.fn(),
          } as unknown as Manager;
          return cb(manager);
        },
      );

      await expect(service.update('nope', { bio: 'x' })).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws when the profile does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.update('u1', { bio: 'x' })).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
