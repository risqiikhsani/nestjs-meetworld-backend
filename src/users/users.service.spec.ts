import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { Profile } from '../profiles/entities/profile.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

type RepoMock = jest.Mocked<
  Pick<
    Repository<User>,
    'find' | 'findOne' | 'findOneBy' | 'create' | 'save' | 'update' | 'remove'
  >
>;
type ProfileRepoMock = jest.Mocked<Pick<Repository<Profile>, 'findOneBy'>>;
type Manager = Pick<EntityManager, 'findOneBy' | 'save' | 'create'>;

describe('UsersService', () => {
  let service: UsersService;
  let repo: RepoMock;
  let profileRepo: ProfileRepoMock;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    profileRepo = {
      findOneBy: jest.fn(),
    };

    // The service's `update` method runs inside `dataSource.transaction`. The
    // mock invokes the callback with a manager that forwards to the
    // user/profile repository mocks, so the existing `repo.*` and
    // `profileRepo.*` assertions still observe the right calls.
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
                  if (Entity === User) {
                    return Promise.resolve(repo.findOneBy(opts));
                  }
                  if (Entity === Profile) {
                    return Promise.resolve(profileRepo.findOneBy(opts));
                  }
                  return Promise.resolve(null);
                },
              ),
            save: jest
              .fn()
              .mockImplementation((entity: Parameters<typeof repo.save>[0]) =>
                repo.save(entity),
              ),
            create: jest
              .fn()
              .mockImplementation(
                (_Entity: unknown, data: object): User | Profile =>
                  ({ ...data }) as User | Profile,
              ),
          } as unknown as Manager;
          return cb(manager);
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: getRepositoryToken(Profile), useValue: profileRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('findAll returns the repository find() result ordered by createdAt DESC', async () => {
    const users = [{ id: 'u1' } as User];
    repo.find.mockResolvedValue(users);

    await expect(service.findAll()).resolves.toBe(users);
    expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
  });

  it('findOne returns the user when present', async () => {
    const user = { id: 'u1' } as User;
    repo.findOneBy.mockResolvedValue(user);

    await expect(service.findOne('u1')).resolves.toBe(user);
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: 'u1' });
  });

  it('findByEmail returns the user when present (with passwordHash selected)', async () => {
    const user = { id: 'u1', email: 'a@b.com' } as User;
    repo.findOne.mockResolvedValue(user);

    await expect(service.findByEmail('a@b.com')).resolves.toBe(user);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { email: 'a@b.com' },
      select: ['id', 'email', 'name', 'passwordHash'],
    });
  });

  it('findByEmail returns null when missing (does not throw)', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.findByEmail('nope@b.com')).resolves.toBeNull();
  });

  it('findOne throws ResourceNotFoundException when missing', async () => {
    repo.findOneBy.mockResolvedValue(null);

    await expect(service.findOne('nope')).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('findOneWithPasswordHash returns the user with passwordHash selected', async () => {
    const user = { id: 'u1', passwordHash: 'hash' } as User;
    repo.findOne.mockResolvedValue(user);

    await expect(service.findOneWithPasswordHash('u1')).resolves.toBe(user);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: ['id', 'passwordHash'],
    });
  });

  it('findOneWithPasswordHash returns null when missing (does not throw)', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.findOneWithPasswordHash('nope')).resolves.toBeNull();
  });

  it('create persists the user without touching passwordHash by default', async () => {
    const dto: CreateUserDto = { email: 'a@b.com', name: 'Ada' };
    const entity = { id: 'u1', ...dto } as User;
    repo.create.mockReturnValue(entity);
    repo.save.mockResolvedValue(entity);

    await expect(service.create(dto)).resolves.toBe(entity);
    expect(repo.create).toHaveBeenCalledWith(dto);
    expect(repo.save).toHaveBeenCalledWith(entity);
  });

  it('create stores a pre-hashed password when one is provided', async () => {
    const dto: CreateUserDto = { email: 'a@b.com', name: 'Ada' };
    const entity = {
      id: 'u1',
      email: dto.email,
      name: dto.name,
      passwordHash: null,
    } as unknown as User;
    repo.create.mockReturnValue(entity);
    repo.save.mockResolvedValue(entity);

    // The hash is computed upstream (AuthService); this service just
    // persists what's given to it.
    await expect(service.create(dto, 'pre-hashed')).resolves.toBe(entity);
    expect(entity.passwordHash).toBe('pre-hashed');
    expect(repo.save).toHaveBeenCalledWith(entity);
  });

  it('update fetches the user, merges the dto, and saves', async () => {
    const user = { id: 'u1', email: 'a@b.com', name: 'Ada' } as User;
    repo.findOneBy.mockResolvedValue(user);
    repo.save.mockResolvedValue({ ...user, name: 'Ada Lovelace' });

    await expect(
      service.update('u1', { name: 'Ada Lovelace' }),
    ).resolves.toMatchObject({ name: 'Ada Lovelace' });
    expect(repo.save).toHaveBeenCalled();
  });

  it('update throws when the user does not exist', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.update('nope', { name: 'x' })).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('setPasswordHash writes the hash column via the repository', async () => {
    await expect(
      service.setPasswordHash('u1', 'new-hash'),
    ).resolves.toBeUndefined();
    expect(repo.update).toHaveBeenCalledWith('u1', {
      passwordHash: 'new-hash',
    });
  });

  it('remove fetches the user then deletes it', async () => {
    const user = { id: 'u1' } as User;
    repo.findOneBy.mockResolvedValue(user);
    repo.remove.mockResolvedValue(user);

    await expect(service.remove('u1')).resolves.toBeUndefined();
    expect(repo.remove).toHaveBeenCalledWith(user);
  });

  it('remove throws when the user does not exist', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.remove('nope')).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(repo.remove).not.toHaveBeenCalled();
  });
});
