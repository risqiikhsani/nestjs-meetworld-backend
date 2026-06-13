import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@Controller('users/:userId/posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.postsService.findAllForUser(userId);
  }

  @Get(':id')
  findOne(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.postsService.findOne(userId, id);
  }

  @Post()
  create(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.postsService.remove(userId, id);
  }
}
