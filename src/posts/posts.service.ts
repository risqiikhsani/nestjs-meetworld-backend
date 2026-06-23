import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { UsersService } from '../users/users.service';
import { FEED_DEFAULT_LIMIT, FEED_MAX_LIMIT } from './dto/feed-query.dto';
import { FeedResponseDto } from './dto/feed-response.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post } from './entities/post.entity';

const TTL_LIST_SECONDS = 60;
const TTL_POST_SECONDS = 300;

const listKey = (userId: string): string => `posts:v1:user:${userId}:all`;
const postKey = (id: string): string => `posts:v1:post:${id}`;

type FeedCursor = { t: string; i: string };

const encodeCursor = (c: FeedCursor): string =>
  Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');

const decodeCursor = (raw: string): FeedCursor => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException('cursor is malformed');
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as FeedCursor).t !== 'string' ||
    typeof (parsed as FeedCursor).i !== 'string'
  ) {
    throw new BadRequestException('cursor is malformed');
  }
  return parsed as FeedCursor;
};

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly usersService: UsersService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async findAllForUser(userId: string): Promise<Post[]> {
    const key = listKey(userId);

    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as Post[];
    } catch (err) {
      this.logger.warn(
        `Redis GET failed for ${key}; falling through to DB. ${(err as Error).message}`,
      );
    }

    await this.usersService.findOne(userId);
    const posts = await this.postsRepository.find({
      where: { authorId: userId },
      order: { createdAt: 'DESC' },
    });

    try {
      await this.redis.set(key, JSON.stringify(posts), 'EX', TTL_LIST_SECONDS);
    } catch (err) {
      this.logger.warn(
        `Redis SET failed for ${key}; result not cached. ${(err as Error).message}`,
      );
    }

    return posts;
  }

  async findOne(id: string): Promise<Post> {
    const key = postKey(id);

    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as Post;
    } catch (err) {
      this.logger.warn(
        `Redis GET failed for ${key}; falling through to DB. ${(err as Error).message}`,
      );
    }

    const post = await this.postsRepository.findOneBy({ id });
    if (!post) {
      throw new ResourceNotFoundException('Post', id);
    }

    try {
      await this.redis.set(key, JSON.stringify(post), 'EX', TTL_POST_SECONDS);
    } catch (err) {
      this.logger.warn(
        `Redis SET failed for ${key}; result not cached. ${(err as Error).message}`,
      );
    }

    return post;
  }

  /**
   * Look up a post by id without scoping to a user. Used by downstream
   * services (e.g. comments) that need to verify a post exists but do
   * not know the post's author. Throws 404 if missing.
   */
  async findOneById(id: string): Promise<Post> {
    const post = await this.postsRepository.findOneBy({ id });
    if (!post) {
      throw new ResourceNotFoundException('Post', id);
    }
    return post;
  }

  /**
   * Global feed: posts from every user, newest first. Each item carries
   * a partial `author` (`{ id, name }`) so the client can render "who
   * posted this" without a follow-up request. Cursor-paginated with a
   * composite (createdAt, id) cursor so paging is stable under inserts.
   *
   * Not cached. The existing per-user caches work because writes are
   * scoped to a single key; the feed would have to invalidate on every
   * create/update/delete, and cursor-paginated requests are mostly unique
   * anyway. Add caching later if read traffic justifies it.
   */
  async findFeed(
    cursor: string | undefined,
    limit?: number,
  ): Promise<FeedResponseDto> {
    const effectiveLimit = this.clampLimit(limit);
    const decoded = cursor ? decodeCursor(cursor) : null;

    const qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoin('post.author', 'author')
      .addSelect(['author.id', 'author.name'])
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .limit(effectiveLimit + 1);

    if (decoded) {
      qb.where(
        '(post.createdAt < :cursorTime OR (post.createdAt = :cursorTime AND post.id < :cursorId))',
        { cursorTime: decoded.t, cursorId: decoded.i },
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > effectiveLimit;
    const items = hasMore ? rows.slice(0, effectiveLimit) : rows;
    const tail = hasMore ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && tail
        ? encodeCursor({ t: tail.createdAt.toISOString(), i: tail.id })
        : null;

    return { items, nextCursor };
  }

  private clampLimit(limit: number | undefined): number {
    if (!limit || Number.isNaN(limit)) return FEED_DEFAULT_LIMIT;
    if (limit < 1) return 1;
    if (limit > FEED_MAX_LIMIT) return FEED_MAX_LIMIT;
    return limit;
  }

  async create(userId: string, dto: CreatePostDto): Promise<Post> {
    const entity = this.postsRepository.create({ ...dto, authorId: userId });
    const saved = await this.postsRepository.save(entity);

    await this.invalidateKeys([listKey(userId)]);
    return saved;
  }

  async update(id: string, userId: string, dto: UpdatePostDto): Promise<Post> {
    const post = await this.findOne(id);
    this.assertOwnership(post, userId);

    Object.assign(post, dto);
    const saved = await this.postsRepository.save(post);

    await this.invalidateKeys([postKey(id), listKey(post.authorId)]);
    return saved;
  }

  async remove(id: string, userId: string): Promise<void> {
    const post = await this.findOne(id);
    this.assertOwnership(post, userId);

    await this.postsRepository.remove(post);
    await this.invalidateKeys([postKey(id), listKey(post.authorId)]);
  }

  private assertOwnership(post: Post, userId: string): void {
    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only modify your own posts.');
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
}
