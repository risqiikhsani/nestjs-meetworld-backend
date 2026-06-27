import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { QueryFailedError, Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { PostsService } from '../posts/posts.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { Like } from './entity/like.entity';

const TTL_LIST_SECONDS = 60;
const TTL_LIKE_SECONDS = 300;

const listKey = (postId: string): string => `likes:v1:post:${postId}:all`;
const likeKey = (id: string): string => `likes:v1:like:${id}`;

// Postgres SQLSTATE for a unique-constraint violation. When the user tries
// to like the same post twice, the DB raises this against `uq_likes_author_post`
// and we surface it as 409 Conflict.
const PG_UNIQUE_VIOLATION = '23505';
const UNIQUE_LIKES_AUTHOR_POST = 'uq_likes_author_post';

@Injectable()
export class LikesService {
  private readonly logger = new Logger(LikesService.name);

  constructor(
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    private readonly postsService: PostsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async findAllForPost(postId: string): Promise<Like[]> {
    const key = listKey(postId);

    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as Like[];
    } catch (err) {
      this.logger.warn(
        `Redis GET failed for ${key}; falling through to DB. ${(err as Error).message}`,
      );
    }

    await this.postsService.findOneById(postId);
    const likes = await this.likesRepository.find({
      where: { postId },
      order: { createdAt: 'DESC' },
      relations: ['author'],
    });

    try {
      await this.redis.set(key, JSON.stringify(likes), 'EX', TTL_LIST_SECONDS);
    } catch (err) {
      this.logger.warn(
        `Redis SET failed for ${key}; result not cached. ${(err as Error).message}`,
      );
    }

    return likes;
  }

  async findOne(id: string): Promise<Like> {
    const key = likeKey(id);

    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as Like;
    } catch (err) {
      this.logger.warn(
        `Redis GET failed for ${key}; falling through to DB. ${(err as Error).message}`,
      );
    }

    const like = await this.likesRepository.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!like) {
      throw new ResourceNotFoundException('Like', id);
    }

    try {
      await this.redis.set(key, JSON.stringify(like), 'EX', TTL_LIKE_SECONDS);
    } catch (err) {
      this.logger.warn(
        `Redis SET failed for ${key}; result not cached. ${(err as Error).message}`,
      );
    }

    return like;
  }

  async create(userId: string, postId: string): Promise<Like> {
    await this.postsService.findOneById(postId);

    const entity = this.likesRepository.create({ authorId: userId, postId });
    let saved: Like;
    try {
      saved = await this.likesRepository.save(entity);
    } catch (err) {
      if (this.isDuplicateLikeError(err)) {
        throw new ConflictException('You already liked this post.');
      }
      throw err;
    }

    // `save()` only returns the columns we inserted; the relation has to be
    // fetched separately so the response can show the liker's name.
    const withAuthor = await this.likesRepository.findOne({
      where: { id: saved.id },
      relations: ['author'],
    });

    await this.invalidateKeys([listKey(postId)]);
    return withAuthor!;
  }

  async remove(id: string, userId: string): Promise<void> {
    const like = await this.findOne(id);
    this.assertOwnership(like, userId);

    await this.likesRepository.remove(like);
    await this.invalidateKeys([likeKey(id), listKey(like.postId)]);
  }

  private assertOwnership(like: Like, userId: string): void {
    if (like.authorId !== userId) {
      throw new ForbiddenException('You can only remove your own likes.');
    }
  }

  private async invalidateKeys(keys: string[]): Promise<void> {
    try {
      await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(
        `Redis DEL failed for ${keys.join(',')}; cache may be stale until TTL. ${(err as Error).message}`,
      );
    }
  }

  // The unique index is the source of truth for "one like per user per post";
  // the service just translates the DB error into an HTTP-friendly exception.
  private isDuplicateLikeError(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) return false;
    const driverErr = err as QueryFailedError & {
      code?: string;
      constraint?: string;
    };
    return (
      driverErr.code === PG_UNIQUE_VIOLATION &&
      driverErr.constraint === UNIQUE_LIKES_AUTHOR_POST
    );
  }
}
