import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.abstract';

@Injectable()
export class S3StorageService extends StorageService {
  private readonly bucket: string;

  constructor(
    private readonly s3: S3Client,
    config: ConfigService,
  ) {
    super();
    this.bucket = config.getOrThrow<string>('AWS_S3_BUCKET');
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: 'public-read',
      }),
    );
    const region = await this.s3.config.region();
    if (!region) {
      throw new Error('S3 client has no region configured');
    }
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }
}
