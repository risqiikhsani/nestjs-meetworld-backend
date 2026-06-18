import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { UsersService } from '../users/users.service';
import { CreatePostDto } from './dto/create-post.dto';
import { Post } from './entities/post.entity';
import { PostsService } from './posts.service';

type RepoMock = jest.Mocked<
  Pick<Repository<Post>, 'find' | 'findOneBy' | 'create' | 'save' | 'remove'>
>;
type RedisMock = jest.Mocked<Pick<Redis, 'get' | 'set' | 'del' | 'ping'>>;

describe('PostsService', () => {
  let service: PostsService;
  let repo: RepoMock;
  let redis: RedisMock;
  let usersService: jest.Mocked<Pick<UsersService, 'findOne'>>;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      ping: jest.fn(),
    };
    usersService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getRepositoryToken(Post), useValue: repo },
        { provide: UsersService, useValue: usersService },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(PostsService);
  });

  it('findAllForUser verifies the parent user exists then lists posts', async () => {
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    const posts = [{ id: 'p1' } as Post];
    repo.find.mockResolvedValue(posts);
    redis.get.mockResolvedValue(null);

    await expect(service.findAllForUser('u1')).resolves.toBe(posts);
    expect(usersService.findOne).toHaveBeenCalledWith('u1');
    expect(repo.find).toHaveBeenCalledWith({
      where: { authorId: 'u1' },
      order: { createdAt: 'DESC' },
    });
  });

  it('findAllForUser propagates a 404 when the user does not exist', async () => {
    usersService.findOne.mockRejectedValue(
      new ResourceNotFoundException('User', 'nope'),
    );
    redis.get.mockResolvedValue(null);

    await expect(service.findAllForUser('nope')).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('findAllForUser returns cached posts without hitting the DB on a hit', async () => {
    const cached = [{ id: 'p1', title: 'cached' } as unknown as Post];
    redis.get.mockResolvedValue(JSON.stringify(cached));

    await expect(service.findAllForUser('u1')).resolves.toEqual(cached);
    expect(repo.find).not.toHaveBeenCalled();
    expect(usersService.findOne).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('findAllForUser writes to cache after a DB miss', async () => {
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    const posts = [{ id: 'p1', title: 'fresh' } as Post];
    repo.find.mockResolvedValue(posts);
    redis.get.mockResolvedValue(null);

    await service.findAllForUser('u1');

    expect(redis.set).toHaveBeenCalledWith(
      'posts:v1:user:u1:all',
      JSON.stringify(posts),
      'EX',
      60,
    );
  });

  it('findAllForUser falls through to DB when redis.get throws', async () => {
    redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    repo.find.mockResolvedValue([]);

    await expect(service.findAllForUser('u1')).resolves.toEqual([]);
    expect(repo.find).toHaveBeenCalled();
  });

  it('findOne returns the post scoped to the parent user', async () => {
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    const post = { id: 'p1', authorId: 'u1' } as Post;
    repo.findOneBy.mockResolvedValue(post);
    redis.get.mockResolvedValue(null);

    await expect(service.findOne('u1', 'p1')).resolves.toBe(post);
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: 'p1', authorId: 'u1' });
  });

  it('findOne throws ResourceNotFoundException when the post is missing', async () => {
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    repo.findOneBy.mockResolvedValue(null);
    redis.get.mockResolvedValue(null);

    await expect(service.findOne('u1', 'p1')).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('findOne returns the cached post on a hit', async () => {
    const cached = { id: 'p1', authorId: 'u1' } as Post;
    redis.get.mockResolvedValue(JSON.stringify(cached));

    await expect(service.findOne('u1', 'p1')).resolves.toEqual(cached);
    expect(repo.findOneBy).not.toHaveBeenCalled();
  });

  it('findOne writes to cache after a DB miss', async () => {
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    const post = { id: 'p1', authorId: 'u1', title: 't' } as Post;
    repo.findOneBy.mockResolvedValue(post);
    redis.get.mockResolvedValue(null);

    await service.findOne('u1', 'p1');

    expect(redis.set).toHaveBeenCalledWith(
      'posts:v1:user:u1:post:p1',
      JSON.stringify(post),
      'EX',
      300,
    );
  });

  it('findOne falls through to DB when redis.get throws', async () => {
    redis.get.mockRejectedValue(new Error('READONLY'));
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    const post = { id: 'p1', authorId: 'u1' } as Post;
    repo.findOneBy.mockResolvedValue(post);

    await expect(service.findOne('u1', 'p1')).resolves.toBe(post);
  });

  it('create sets authorId from the URL param, not the DTO body', async () => {
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    const dto: CreatePostDto = { title: 't', body: 'b' };
    const entity = { id: 'p1', ...dto, authorId: 'u1' } as Post;
    repo.create.mockReturnValue(entity);
    repo.save.mockResolvedValue(entity);

    await expect(service.create('u1', dto)).resolves.toBe(entity);
    expect(repo.create).toHaveBeenCalledWith({ ...dto, authorId: 'u1' });
    expect(redis.del).toHaveBeenCalledWith('posts:v1:user:u1:all');
  });

  it('update fetches, merges, and saves the post', async () => {
    const post = { id: 'p1', authorId: 'u1', title: 't', body: 'b' } as Post;
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    repo.findOneBy.mockResolvedValue(post);
    repo.save.mockResolvedValue({ ...post, title: 't2' });
    redis.get.mockResolvedValue(null);

    await expect(
      service.update('u1', 'p1', { title: 't2' }),
    ).resolves.toMatchObject({ title: 't2' });
    expect(repo.save).toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith(
      'posts:v1:user:u1:post:p1',
      'posts:v1:user:u1:all',
    );
  });

  it('remove fetches the post then deletes it', async () => {
    const post = { id: 'p1', authorId: 'u1' } as Post;
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    repo.findOneBy.mockResolvedValue(post);
    repo.remove.mockResolvedValue(post);
    redis.get.mockResolvedValue(null);

    await expect(service.remove('u1', 'p1')).resolves.toBeUndefined();
    expect(repo.remove).toHaveBeenCalledWith(post);
    expect(redis.del).toHaveBeenCalledWith(
      'posts:v1:user:u1:post:p1',
      'posts:v1:user:u1:all',
    );
  });

  it('still completes remove when redis.del throws', async () => {
    redis.del.mockRejectedValue(new Error('ETIMEDOUT'));
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    const post = { id: 'p1', authorId: 'u1' } as Post;
    repo.findOneBy.mockResolvedValue(post);
    repo.remove.mockResolvedValue(post);
    redis.get.mockResolvedValue(null);

    await expect(service.remove('u1', 'p1')).resolves.toBeUndefined();
    expect(repo.remove).toHaveBeenCalled();
  });
});
