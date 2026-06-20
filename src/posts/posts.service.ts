import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { UsersService } from '../users/users.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post } from './entities/post.entity';

const TTL_LIST_SECONDS = 60;
const TTL_POST_SECONDS = 300;

const listKey = (userId: string): string => `posts:v1:user:${userId}:all`;
const postKey = (userId: string, id: string): string =>
  `posts:v1:user:${userId}:post:${id}`;

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

  async findOne(userId: string, id: string): Promise<Post> {
    const key = postKey(userId, id);

    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as Post;
    } catch (err) {
      this.logger.warn(
        `Redis GET failed for ${key}; falling through to DB. ${(err as Error).message}`,
      );
    }

    await this.usersService.findOne(userId);
    const post = await this.postsRepository.findOneBy({ id, authorId: userId });
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

  async create(userId: string, dto: CreatePostDto): Promise<Post> {
    await this.usersService.findOne(userId);
    const entity = this.postsRepository.create({ ...dto, authorId: userId });
    const saved = await this.postsRepository.save(entity);

    await this.invalidateKeys([listKey(userId)]);
    return saved;
  }

  async update(userId: string, id: string, dto: UpdatePostDto): Promise<Post> {
    const post = await this.findOne(userId, id);
    Object.assign(post, dto);
    const saved = await this.postsRepository.save(post);

    await this.invalidateKeys([postKey(userId, id), listKey(userId)]);
    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const post = await this.findOne(userId, id);
    await this.postsRepository.remove(post);
    await this.invalidateKeys([postKey(userId, id), listKey(userId)]);
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
