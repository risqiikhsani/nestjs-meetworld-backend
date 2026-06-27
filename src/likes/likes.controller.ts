import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SWAGGER_BEARER_NAME } from '../config/swagger.config';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { LikesService } from './likes.service';
import { Like as LikeEntity } from './entity/like.entity';

type AuthenticatedUser = { id: string; email: string };

@ApiTags('likes')
@ApiBearerAuth(SWAGGER_BEARER_NAME)
@Controller()
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Get('posts/:postId/likes')
  @ApiOperation({ summary: 'List likes on a post' })
  @ApiParam({ name: 'postId', format: 'uuid' })
  @ApiOkResponse({ type: LikeEntity, isArray: true })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({
    description: 'Parent post was not found.',
    type: ErrorResponseDto,
  })
  findAll(@Param('postId', new ParseUUIDPipe()) postId: string) {
    return this.likesService.findAllForPost(postId);
  }

  @Post('posts/:postId/likes')
  @ApiOperation({ summary: 'Like a post as the authenticated user' })
  @ApiParam({ name: 'postId', format: 'uuid' })
  @ApiCreatedResponse({ type: LikeEntity })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({
    description: 'Parent post was not found.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'The current user already liked this post.',
    type: ErrorResponseDto,
  })
  create(
    @Param('postId', new ParseUUIDPipe()) postId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.likesService.create(user.id, postId);
  }

  @Get('likes/:id')
  @ApiOperation({ summary: 'Get a like by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: LikeEntity })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.likesService.findOne(id);
  }

  @Delete('likes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a like (author only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({
    description: 'The current user is not the author of this like.',
    type: ErrorResponseDto,
  })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.likesService.remove(id, user.id);
  }
}
