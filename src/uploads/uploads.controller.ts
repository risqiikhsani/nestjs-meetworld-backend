import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { SWAGGER_BEARER_NAME } from '../config/swagger.config';
import {
  UploadManyResponseDto,
  UploadResponseDto,
} from './dto/upload-response.dto';
import { UploadsService } from './uploads.service';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_FILES_COUNT = 10;

const multerOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
};

@ApiTags('uploads')
@ApiBearerAuth(SWAGGER_BEARER_NAME)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a single file (multipart). Max 25 MB.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: UploadResponseDto })
  uploadOne(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    return this.uploadsService.uploadOne(file);
  }

  @Post('many')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_COUNT, multerOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: `Upload up to ${MAX_FILES_COUNT} files (multipart). Max 25 MB each.`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['files'],
    },
  })
  @ApiOkResponse({ type: UploadManyResponseDto })
  uploadMany(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<UploadManyResponseDto> {
    return this.uploadsService.uploadMany(files);
  }
}
