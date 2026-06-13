import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { S3_CLIENT } from './uploads.constants';

@Injectable()
export class UploadsService {
  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    private readonly config: ConfigService,
  ) {}

  async uploadOne(file: Express.Multer.File): Promise<string> {
    const ext = path.extname(file.originalname).toLowerCase();
    const datePrefix = new Date().toISOString().slice(0, 10);
    const key = `${datePrefix}/${randomUUID()}${ext}`;

    const bucket = this.config.getOrThrow<string>('AWS_S3_BUCKET');

    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      }),
    );

    const region = await this.s3.config.region();
    if (!region) {
      throw new Error('S3 client has no region configured');
    }
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  uploadMany(files: Express.Multer.File[]): Promise<string[]> {
    return Promise.all(files.map((f) => this.uploadOne(f)));
  }
}
