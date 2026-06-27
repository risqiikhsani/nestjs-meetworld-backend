import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { QueryFailedError, Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { PostsService } from '../posts/posts.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { Like } from './entity/like.entity';
import { LikesService } from './likes.service';

type RepoMock = jest.Mocked<
  Pick<Repository<Like>, 'find' | 'findOne' | 'create' | 'save' | 'remove'>
>;
type RedisMock = jest.Mocked<Pick<Redis, 'get' | 'set' | 'del' | 'ping'>>;
type PostsServiceMock = jest.Mocked<Pick<PostsService, 'findOneById'>>;

const makeDuplicateError = (): QueryFailedError => {
  // TypeORM's QueryFailedError wraps the underlying pg driver error, which
  // exposes `code` (SQLSTATE) and `constraint` (the violated index name).
  const driverErr = Object.assign(
    new Error('duplicate key value violates unique constraint'),
    {
      code: '23505',
      constraint: 'uq_likes_author_post',
    },
  );
  const qf = new QueryFailedError('INSERT INTO "likes" ...', [], driverErr);
  return qf;
};

describe('LikesService', () => {
  let service: LikesService;
  let repo: RepoMock;
  let redis: RedisMock;
  let postsService: PostsServiceMock;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
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
    postsService = {
      findOneById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LikesService,
        { provide: getRepositoryToken(Like), useValue: repo },
        { provide: PostsService, useValue: postsService },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(LikesService);
  });

  describe('findAllForPost', () => {
    it('verifies the parent post exists then lists likes for it', async () => {
      postsService.findOneById.mockResolvedValue({ id: 'p1' });
      const likes = [{ id: 'l1', postId: 'p1' } as Like];
      repo.find.mockResolvedValue(likes);
      redis.get.mockResolvedValue(null);

      await expect(service.findAllForPost('p1')).resolves.toBe(likes);
      expect(postsService.findOneById).toHaveBeenCalledWith('p1');
      expect(repo.find).toHaveBeenCalledWith({
        where: { postId: 'p1' },
        order: { createdAt: 'DESC' },
        relations: ['author'],
      });
    });

    it('propagates a 404 when the parent post does not exist', async () => {
      postsService.findOneById.mockRejectedValue(
        new ResourceNotFoundException('Post', 'nope'),
      );
      redis.get.mockResolvedValue(null);

      await expect(service.findAllForPost('nope')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('returns cached likes without hitting the DB on a cache hit', async () => {
      const cached = [{ id: 'l1', postId: 'p1' } as unknown as Like];
      redis.get.mockResolvedValue(JSON.stringify(cached));

      await expect(service.findAllForPost('p1')).resolves.toEqual(cached);
      expect(repo.find).not.toHaveBeenCalled();
      expect(postsService.findOneById).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('writes to cache after a DB miss', async () => {
      postsService.findOneById.mockResolvedValue({ id: 'p1' });
      const likes = [{ id: 'l1', postId: 'p1' } as Like];
      repo.find.mockResolvedValue(likes);
      redis.get.mockResolvedValue(null);

      await service.findAllForPost('p1');

      expect(redis.set).toHaveBeenCalledWith(
        'likes:v1:post:p1:all',
        JSON.stringify(likes),
        'EX',
        60,
      );
    });

    it('falls through to the DB when redis.get throws', async () => {
      redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
      postsService.findOneById.mockResolvedValue({ id: 'p1' });
      repo.find.mockResolvedValue([]);

      await expect(service.findAllForPost('p1')).resolves.toEqual([]);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the like on a cache miss', async () => {
      const like = { id: 'l1' } as Like;
      repo.findOne.mockResolvedValue(like);
      redis.get.mockResolvedValue(null);

      await expect(service.findOne('l1')).resolves.toBe(like);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'l1' },
        relations: ['author'],
      });
    });

    it('throws ResourceNotFoundException when the like is missing', async () => {
      repo.findOne.mockResolvedValue(null);
      redis.get.mockResolvedValue(null);

      await expect(service.findOne('l1')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it('returns the cached like on a hit', async () => {
      const cached = { id: 'l1' } as Like;
      redis.get.mockResolvedValue(JSON.stringify(cached));

      await expect(service.findOne('l1')).resolves.toEqual(cached);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('writes to cache after a DB miss', async () => {
      const like = { id: 'l1', authorId: 'u1' } as Like;
      repo.findOne.mockResolvedValue(like);
      redis.get.mockResolvedValue(null);

      await service.findOne('l1');

      expect(redis.set).toHaveBeenCalledWith(
        'likes:v1:like:l1',
        JSON.stringify(like),
        'EX',
        300,
      );
    });

    it('falls through to the DB when redis.get throws', async () => {
      redis.get.mockRejectedValue(new Error('READONLY'));
      const like = { id: 'l1' } as Like;
      repo.findOne.mockResolvedValue(like);

      await expect(service.findOne('l1')).resolves.toBe(like);
    });
  });

  describe('create', () => {
    it('verifies the post exists, sets authorId and postId, then invalidates the list cache', async () => {
      postsService.findOneById.mockResolvedValue({ id: 'p1' });
      const entity = { id: 'l1', authorId: 'u1', postId: 'p1' } as Like;
      const withAuthor = {
        id: 'l1',
        authorId: 'u1',
        postId: 'p1',
        author: { id: 'u1', name: 'Alice' },
      } as Like;
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);
      repo.findOne.mockResolvedValue(withAuthor);

      await expect(service.create('u1', 'p1')).resolves.toBe(withAuthor);
      expect(repo.create).toHaveBeenCalledWith({
        authorId: 'u1',
        postId: 'p1',
      });
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'l1' },
        relations: ['author'],
      });
      expect(redis.del).toHaveBeenCalledWith('likes:v1:post:p1:all');
    });

    it('propagates a 404 when the parent post does not exist', async () => {
      postsService.findOneById.mockRejectedValue(
        new ResourceNotFoundException('Post', 'nope'),
      );

      await expect(service.create('u1', 'nope')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repo.create).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('translates the unique-violation into ConflictException', async () => {
      postsService.findOneById.mockResolvedValue({ id: 'p1' });
      const entity = { authorId: 'u1', postId: 'p1' } as Like;
      repo.create.mockReturnValue(entity);
      repo.save.mockRejectedValue(makeDuplicateError());

      await expect(service.create('u1', 'p1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('rethrows non-duplicate save errors unchanged', async () => {
      postsService.findOneById.mockResolvedValue({ id: 'p1' });
      const entity = { authorId: 'u1', postId: 'p1' } as Like;
      repo.create.mockReturnValue(entity);
      const unrelated = new Error('connection reset');
      repo.save.mockRejectedValue(unrelated);

      await expect(service.create('u1', 'p1')).rejects.toBe(unrelated);
    });

    it('rethrows unique-violation errors for other constraints unchanged', async () => {
      // The DB might raise 23505 for a different unique index (e.g. a future
      // comment-likes composite). Those are not duplicates of this like.
      postsService.findOneById.mockResolvedValue({ id: 'p1' });
      const entity = { authorId: 'u1', postId: 'p1' } as Like;
      repo.create.mockReturnValue(entity);
      const driverErr = Object.assign(
        new Error('duplicate key value violates unique constraint'),
        { code: '23505', constraint: 'some_other_constraint' },
      );
      const qf = new QueryFailedError('INSERT INTO "likes" ...', [], driverErr);
      repo.save.mockRejectedValue(qf);

      await expect(service.create('u1', 'p1')).rejects.toBe(qf);
    });
  });

  describe('remove', () => {
    it('allows the author to remove their own like', async () => {
      const like = { id: 'l1', postId: 'p1', authorId: 'u1' } as Like;
      repo.findOne.mockResolvedValue(like);
      redis.get.mockResolvedValue(null);
      repo.remove.mockResolvedValue(like);

      await expect(service.remove('l1', 'u1')).resolves.toBeUndefined();
      expect(repo.remove).toHaveBeenCalledWith(like);
      expect(redis.del).toHaveBeenCalledWith(
        'likes:v1:like:l1',
        'likes:v1:post:p1:all',
      );
    });

    it('throws ForbiddenException when the current user is not the author', async () => {
      const like = { id: 'l1', postId: 'p1', authorId: 'u1' } as Like;
      repo.findOne.mockResolvedValue(like);
      redis.get.mockResolvedValue(null);

      await expect(service.remove('l1', 'u2')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repo.remove).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('still completes remove when redis.del throws', async () => {
      redis.del.mockRejectedValue(new Error('ETIMEDOUT'));
      const like = { id: 'l1', postId: 'p1', authorId: 'u1' } as Like;
      repo.findOne.mockResolvedValue(like);
      redis.get.mockResolvedValue(null);
      repo.remove.mockResolvedValue(like);

      await expect(service.remove('l1', 'u1')).resolves.toBeUndefined();
      expect(repo.remove).toHaveBeenCalled();
    });
  });
});
