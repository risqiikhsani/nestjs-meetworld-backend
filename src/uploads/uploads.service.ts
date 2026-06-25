import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import {
  UploadManyResponseDto,
  UploadResponseDto,
} from './dto/upload-response.dto';
import { StorageService } from './storage/storage.abstract';

@Injectable()
export class UploadsService {
  constructor(private readonly storage: StorageService) {}

  async uploadOne(file: Express.Multer.File): Promise<UploadResponseDto> {
    const ext = path.extname(file.originalname).toLowerCase();
    const datePrefix = new Date().toISOString().slice(0, 10);
    const key = `${datePrefix}/${randomUUID()}${ext}`;
    const url = await this.storage.upload(key, file.buffer, file.mimetype);
    return { url };
  }

  async uploadMany(
    files: Express.Multer.File[],
  ): Promise<UploadManyResponseDto> {
    const urls = await Promise.all(
      files.map(async (f) => (await this.uploadOne(f)).url),
    );
    return { urls };
  }
}
