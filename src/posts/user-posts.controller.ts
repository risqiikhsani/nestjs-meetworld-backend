import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { SWAGGER_BEARER_NAME } from '../config/swagger.config';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { Post as PostEntity } from './entities/post.entity';
import { PostsService } from './posts.service';

@ApiTags('posts')
@ApiBearerAuth(SWAGGER_BEARER_NAME)
@Controller('users/:userId/posts')
export class UserPostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @ApiOperation({ summary: 'List posts for a user' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({ type: PostEntity, isArray: true })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({
    description: 'Parent user was not found.',
    type: ErrorResponseDto,
  })
  findAll(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.postsService.findAllForUser(userId);
  }
}
