import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';
import { UsersService } from '../users/users.service';
import { CreatePostDto } from './dto/create-post.dto';
import { Post } from './entities/post.entity';
import { PostsService } from './posts.service';

type RepoMock = jest.Mocked<
  Pick<Repository<Post>, 'find' | 'findOneBy' | 'create' | 'save' | 'remove'>
>;

describe('PostsService', () => {
  let service: PostsService;
  let repo: RepoMock;
  let usersService: jest.Mocked<Pick<UsersService, 'findOne'>>;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    usersService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getRepositoryToken(Post), useValue: repo },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(PostsService);
  });

  it('findAllForUser verifies the parent user exists then lists posts', async () => {
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    const posts = [{ id: 'p1' } as Post];
    repo.find.mockResolvedValue(posts);

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

    await expect(service.findAllForUser('nope')).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('findOne returns the post scoped to the parent user', async () => {
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    const post = { id: 'p1', authorId: 'u1' } as Post;
    repo.findOneBy.mockResolvedValue(post);

    await expect(service.findOne('u1', 'p1')).resolves.toBe(post);
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: 'p1', authorId: 'u1' });
  });

  it('findOne throws ResourceNotFoundException when the post is missing', async () => {
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    repo.findOneBy.mockResolvedValue(null);

    await expect(service.findOne('u1', 'p1')).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('create sets authorId from the URL param, not the DTO body', async () => {
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    const dto: CreatePostDto = { title: 't', body: 'b' };
    const entity = { id: 'p1', ...dto, authorId: 'u1' } as Post;
    repo.create.mockReturnValue(entity);
    repo.save.mockResolvedValue(entity);

    await expect(service.create('u1', dto)).resolves.toBe(entity);
    expect(repo.create).toHaveBeenCalledWith({ ...dto, authorId: 'u1' });
  });

  it('update fetches, merges, and saves the post', async () => {
    const post = { id: 'p1', authorId: 'u1', title: 't', body: 'b' } as Post;
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    repo.findOneBy.mockResolvedValue(post);
    repo.save.mockResolvedValue({ ...post, title: 't2' });

    await expect(
      service.update('u1', 'p1', { title: 't2' }),
    ).resolves.toMatchObject({ title: 't2' });
    expect(repo.save).toHaveBeenCalled();
  });

  it('remove fetches the post then deletes it', async () => {
    const post = { id: 'p1', authorId: 'u1' } as Post;
    usersService.findOne.mockResolvedValue({ id: 'u1' } as never);
    repo.findOneBy.mockResolvedValue(post);
    repo.remove.mockResolvedValue(post);

    await expect(service.remove('u1', 'p1')).resolves.toBeUndefined();
    expect(repo.remove).toHaveBeenCalledWith(post);
  });
});
