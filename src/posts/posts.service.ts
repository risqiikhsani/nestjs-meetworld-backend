import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { UsersService } from '../users/users.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post } from './entities/post.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly usersService: UsersService,
  ) {}

  async findAllForUser(userId: string): Promise<Post[]> {
    await this.usersService.findOne(userId);
    return this.postsRepository.find({
      where: { authorId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Post> {
    await this.usersService.findOne(userId);
    const post = await this.postsRepository.findOneBy({ id, authorId: userId });
    if (!post) {
      throw new ResourceNotFoundException('Post', id);
    }
    return post;
  }

  async create(userId: string, dto: CreatePostDto): Promise<Post> {
    await this.usersService.findOne(userId);
    const entity = this.postsRepository.create({ ...dto, authorId: userId });
    return this.postsRepository.save(entity);
  }

  async update(userId: string, id: string, dto: UpdatePostDto): Promise<Post> {
    const post = await this.findOne(userId, id);
    Object.assign(post, dto);
    return this.postsRepository.save(post);
  }

  async remove(userId: string, id: string): Promise<void> {
    const post = await this.findOne(userId, id);
    await this.postsRepository.remove(post);
  }
}
