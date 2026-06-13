import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

type RepoMock = jest.Mocked<
  Pick<Repository<User>, 'find' | 'findOneBy' | 'create' | 'save' | 'remove'>
>;

describe('UsersService', () => {
  let service: UsersService;
  let repo: RepoMock;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
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

  it('findOne throws ResourceNotFoundException when missing', async () => {
    repo.findOneBy.mockResolvedValue(null);

    await expect(service.findOne('nope')).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('create persists and returns the user', async () => {
    const dto: CreateUserDto = { email: 'a@b.com', name: 'Ada' };
    const entity = { id: 'u1', ...dto } as User;
    repo.create.mockReturnValue(entity);
    repo.save.mockResolvedValue(entity);

    await expect(service.create(dto)).resolves.toBe(entity);
    expect(repo.create).toHaveBeenCalledWith(dto);
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
