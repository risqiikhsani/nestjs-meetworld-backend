import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { StorageService } from './storage/storage.abstract';

@Injectable()
export class UploadsService {
  constructor(private readonly storage: StorageService) {}

  async uploadOne(file: Express.Multer.File): Promise<string> {
    const ext = path.extname(file.originalname).toLowerCase();
    const datePrefix = new Date().toISOString().slice(0, 10);
    const key = `${datePrefix}/${randomUUID()}${ext}`;
    return this.storage.upload(key, file.buffer, file.mimetype);
  }

  uploadMany(files: Express.Multer.File[]): Promise<string[]> {
    return Promise.all(files.map((f) => this.uploadOne(f)));
  }
}
