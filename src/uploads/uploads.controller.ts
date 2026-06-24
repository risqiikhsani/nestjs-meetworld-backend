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
  @ApiOkResponse({
    description:
      'Public URL of the uploaded object (provider-dependent: S3 or GCS).',
    schema: {
      type: 'string',
      example:
        'https://meetworld-uploads.s3.us-east-1.amazonaws.com/2026-06-18/abc.jpg',
    },
  })
  uploadOne(@UploadedFile() file: Express.Multer.File): Promise<string> {
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
  @ApiOkResponse({
    description: 'Public URLs in upload order (provider-dependent: S3 or GCS).',
    schema: {
      type: 'array',
      items: {
        type: 'string',
        example:
          'https://meetworld-uploads.s3.us-east-1.amazonaws.com/2026-06-18/abc.jpg',
      },
    },
  })
  uploadMany(@UploadedFiles() files: Express.Multer.File[]): Promise<string[]> {
    return this.uploadsService.uploadMany(files);
  }
}
