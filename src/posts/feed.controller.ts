import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { SWAGGER_BEARER_NAME } from '../config/swagger.config';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedResponseDto } from './dto/feed-response.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@ApiBearerAuth(SWAGGER_BEARER_NAME)
@Controller('posts')
export class FeedController {
  constructor(private readonly postsService: PostsService) {}

  @Get('feed')
  @ApiOperation({
    summary: 'Global feed of posts from every user, newest first',
  })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: FeedResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  findFeed(@Query() query: FeedQueryDto) {
    return this.postsService.findFeed(query.cursor, query.limit);
  }
}
