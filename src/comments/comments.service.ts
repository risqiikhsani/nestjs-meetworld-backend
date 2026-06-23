import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { PostsService } from '../posts/posts.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment } from './entities/comment.entity';

const TTL_LIST_SECONDS = 60;
const TTL_COMMENT_SECONDS = 300;

const listKey = (postId: string): string => `comments:v1:post:${postId}:all`;
const commentKey = (id: string): string => `comments:v1:comment:${id}`;

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    private readonly postsService: PostsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async findAllForPost(postId: string): Promise<Comment[]> {
    const key = listKey(postId);

    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as Comment[];
    } catch (err) {
      this.logger.warn(
        `Redis GET failed for ${key}; falling through to DB. ${(err as Error).message}`,
      );
    }

    await this.postsService.findOneById(postId);
    const comments = await this.commentsRepository.find({
      where: { postId },
      order: { createdAt: 'DESC' },
      relations: ['author'],
    });

    try {
      await this.redis.set(
        key,
        JSON.stringify(comments),
        'EX',
        TTL_LIST_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `Redis SET failed for ${key}; result not cached. ${(err as Error).message}`,
      );
    }

    return comments;
  }

  async findOne(id: string): Promise<Comment> {
    const key = commentKey(id);

    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as Comment;
    } catch (err) {
      this.logger.warn(
        `Redis GET failed for ${key}; falling through to DB. ${(err as Error).message}`,
      );
    }

    const comment = await this.commentsRepository.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!comment) {
      throw new ResourceNotFoundException('Comment', id);
    }

    try {
      await this.redis.set(
        key,
        JSON.stringify(comment),
        'EX',
        TTL_COMMENT_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `Redis SET failed for ${key}; result not cached. ${(err as Error).message}`,
      );
    }

    return comment;
  }

  async create(
    postId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    await this.postsService.findOneById(postId);
    const entity = this.commentsRepository.create({
      text: dto.text,
      postId,
      authorId: userId,
    });
    const saved = await this.commentsRepository.save(entity);

    // Reload with the author relation populated. `save()` only returns
    // the columns we inserted; the relation has to be fetched separately.
    const withAuthor = await this.commentsRepository.findOne({
      where: { id: saved.id },
      relations: ['author'],
    });

    await this.invalidateKeys([listKey(postId)]);
    return withAuthor!;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.findOne(id);
    this.assertOwnership(comment, userId);

    Object.assign(comment, dto);
    const saved = await this.commentsRepository.save(comment);

    await this.invalidateKeys([commentKey(id), listKey(comment.postId)]);
    return saved;
  }

  async remove(id: string, userId: string): Promise<void> {
    const comment = await this.findOne(id);
    this.assertOwnership(comment, userId);

    await this.commentsRepository.remove(comment);
    await this.invalidateKeys([commentKey(id), listKey(comment.postId)]);
  }

  private assertOwnership(comment: Comment, userId: string): void {
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only modify your own comments.');
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
