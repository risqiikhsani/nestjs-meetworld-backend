import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { SWAGGER_BEARER_NAME } from '../config/swagger.config';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Profile } from './entities/profile.entity';
import { ProfilesService } from './profiles.service';

@ApiTags('profiles')
@ApiBearerAuth(SWAGGER_BEARER_NAME)
@Controller('users/:userId/profile')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'Get a user’s profile' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({ type: Profile })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  findOne(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.profilesService.findByUserId(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update a user’s profile' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({ type: Profile })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  update(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.update(userId, dto);
  }
}
