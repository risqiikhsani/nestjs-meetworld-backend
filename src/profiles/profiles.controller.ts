import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profiles.service';

@Controller('users/:userId/profile')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  findOne(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.profilesService.findByUserId(userId);
  }

  @Patch()
  update(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.update(userId, dto);
  }
}
