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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment as CommentEntity } from './entities/comment.entity';

type AuthenticatedUser = { id: string; email: string };

@ApiTags('comments')
@ApiBearerAuth(SWAGGER_BEARER_NAME)
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('posts/:postId/comments')
  @ApiOperation({ summary: 'List comments on a post' })
  @ApiParam({ name: 'postId', format: 'uuid' })
  @ApiOkResponse({ type: CommentEntity, isArray: true })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({
    description: 'Parent post was not found.',
    type: ErrorResponseDto,
  })
  findAll(@Param('postId', new ParseUUIDPipe()) postId: string) {
    return this.commentsService.findAllForPost(postId);
  }

  @Get('comments/:id')
  @ApiOperation({ summary: 'Get a comment by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CommentEntity })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.commentsService.findOne(id);
  }

  @Post('posts/:postId/comments')
  @ApiOperation({ summary: 'Create a comment on a post' })
  @ApiParam({ name: 'postId', format: 'uuid' })
  @ApiCreatedResponse({ type: CommentEntity })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({
    description: 'Parent post was not found.',
    type: ErrorResponseDto,
  })
  create(
    @Param('postId', new ParseUUIDPipe()) postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(postId, user.id, dto);
  }

  @Patch('comments/:id')
  @ApiOperation({ summary: 'Update a comment (author only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CommentEntity })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({
    description: 'The current user is not the author of this comment.',
    type: ErrorResponseDto,
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(id, user.id, dto);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment (author only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({
    description: 'The current user is not the author of this comment.',
    type: ErrorResponseDto,
  })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.commentsService.remove(id, user.id);
  }
}
