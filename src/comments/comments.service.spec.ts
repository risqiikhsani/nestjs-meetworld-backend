import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { PostsService } from '../posts/posts.service';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Comment } from './entities/comment.entity';

type RepoMock = jest.Mocked<
  Pick<Repository<Comment>, 'find' | 'findOneBy' | 'create' | 'save' | 'remove'>
>;
type RedisMock = jest.Mocked<Pick<Redis, 'get' | 'set' | 'del' | 'ping'>>;
type PostsServiceMock = jest.Mocked<Pick<PostsService, 'findOneById'>>;

describe('CommentsService', () => {
  let service: CommentsService;
  let repo: RepoMock;
  let redis: RedisMock;
  let postsService: PostsServiceMock;

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
    postsService = {
      findOneById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: repo },
        { provide: PostsService, useValue: postsService },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(CommentsService);
  });

  describe('findAllForPost', () => {
    it('verifies the parent post exists then lists comments for it', async () => {
      postsService.findOneById.mockResolvedValue({ id: 'p1' });
      const comments = [{ id: 'c1', postId: 'p1' } as Comment];
      repo.find.mockResolvedValue(comments);
      redis.get.mockResolvedValue(null);

      await expect(service.findAllForPost('p1')).resolves.toBe(comments);
      expect(postsService.findOneById).toHaveBeenCalledWith('p1');
      expect(repo.find).toHaveBeenCalledWith({
        where: { postId: 'p1' },
        order: { createdAt: 'DESC' },
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

    it('returns cached comments without hitting the DB on a cache hit', async () => {
      const cached = [{ id: 'c1', postId: 'p1' } as unknown as Comment];
      redis.get.mockResolvedValue(JSON.stringify(cached));

      await expect(service.findAllForPost('p1')).resolves.toEqual(cached);
      expect(repo.find).not.toHaveBeenCalled();
      expect(postsService.findOneById).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('writes to cache after a DB miss', async () => {
      postsService.findOneById.mockResolvedValue({ id: 'p1' });
      const comments = [{ id: 'c1', postId: 'p1' } as Comment];
      repo.find.mockResolvedValue(comments);
      redis.get.mockResolvedValue(null);

      await service.findAllForPost('p1');

      expect(redis.set).toHaveBeenCalledWith(
        'comments:v1:post:p1:all',
        JSON.stringify(comments),
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
    it('returns the comment on a cache miss', async () => {
      const comment = { id: 'c1' } as Comment;
      repo.findOneBy.mockResolvedValue(comment);
      redis.get.mockResolvedValue(null);

      await expect(service.findOne('c1')).resolves.toBe(comment);
      expect(repo.findOneBy).toHaveBeenCalledWith({ id: 'c1' });
    });

    it('throws ResourceNotFoundException when the comment is missing', async () => {
      repo.findOneBy.mockResolvedValue(null);
      redis.get.mockResolvedValue(null);

      await expect(service.findOne('c1')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it('returns the cached comment on a cache hit', async () => {
      const cached = { id: 'c1' } as Comment;
      redis.get.mockResolvedValue(JSON.stringify(cached));

      await expect(service.findOne('c1')).resolves.toEqual(cached);
      expect(repo.findOneBy).not.toHaveBeenCalled();
    });

    it('writes to cache after a DB miss', async () => {
      const comment = { id: 'c1', text: 'hi' } as Comment;
      repo.findOneBy.mockResolvedValue(comment);
      redis.get.mockResolvedValue(null);

      await service.findOne('c1');

      expect(redis.set).toHaveBeenCalledWith(
        'comments:v1:comment:c1',
        JSON.stringify(comment),
        'EX',
        300,
      );
    });
  });

  describe('create', () => {
    it('verifies the post exists, sets postId and authorId, then invalidates the list cache', async () => {
      postsService.findOneById.mockResolvedValue({ id: 'p1' });
      const dto: CreateCommentDto = { text: 'nice post' };
      const entity = {
        id: 'c1',
        text: 'nice post',
        postId: 'p1',
        authorId: 'u1',
      } as Comment;
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      await expect(service.create('p1', 'u1', dto)).resolves.toBe(entity);
      expect(repo.create).toHaveBeenCalledWith({
        text: 'nice post',
        postId: 'p1',
        authorId: 'u1',
      });
      expect(redis.del).toHaveBeenCalledWith('comments:v1:post:p1:all');
    });

    it('propagates a 404 when the post does not exist', async () => {
      postsService.findOneById.mockRejectedValue(
        new ResourceNotFoundException('Post', 'nope'),
      );

      await expect(
        service.create('nope', 'u1', { text: 'hi' }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('allows the author to update their own comment', async () => {
      const comment = {
        id: 'c1',
        postId: 'p1',
        authorId: 'u1',
        text: 'old',
      } as Comment;
      repo.findOneBy.mockResolvedValue(comment);
      redis.get.mockResolvedValue(null);
      repo.save.mockResolvedValue({ ...comment, text: 'new' });

      await expect(
        service.update('c1', 'u1', { text: 'new' }),
      ).resolves.toMatchObject({ text: 'new' });
      expect(redis.del).toHaveBeenCalledWith(
        'comments:v1:comment:c1',
        'comments:v1:post:p1:all',
      );
    });

    it('throws ForbiddenException when the current user is not the author', async () => {
      const comment = { id: 'c1', postId: 'p1', authorId: 'u1' } as Comment;
      repo.findOneBy.mockResolvedValue(comment);
      redis.get.mockResolvedValue(null);

      await expect(
        service.update('c1', 'u2', { text: 'hijack' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('allows the author to delete their own comment', async () => {
      const comment = { id: 'c1', postId: 'p1', authorId: 'u1' } as Comment;
      repo.findOneBy.mockResolvedValue(comment);
      redis.get.mockResolvedValue(null);
      repo.remove.mockResolvedValue(comment);

      await expect(service.remove('c1', 'u1')).resolves.toBeUndefined();
      expect(repo.remove).toHaveBeenCalledWith(comment);
      expect(redis.del).toHaveBeenCalledWith(
        'comments:v1:comment:c1',
        'comments:v1:post:p1:all',
      );
    });

    it('throws ForbiddenException when the current user is not the author', async () => {
      const comment = { id: 'c1', postId: 'p1', authorId: 'u1' } as Comment;
      repo.findOneBy.mockResolvedValue(comment);
      redis.get.mockResolvedValue(null);

      await expect(service.remove('c1', 'u2')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });
});
