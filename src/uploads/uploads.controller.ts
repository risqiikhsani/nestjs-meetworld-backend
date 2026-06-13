import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_FILES_COUNT = 10;

const multerOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
};

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadOne(@UploadedFile() file: Express.Multer.File): Promise<string> {
    return this.uploadsService.uploadOne(file);
  }

  @Post('many')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_COUNT, multerOptions))
  uploadMany(@UploadedFiles() files: Express.Multer.File[]): Promise<string[]> {
    return this.uploadsService.uploadMany(files);
  }
}
