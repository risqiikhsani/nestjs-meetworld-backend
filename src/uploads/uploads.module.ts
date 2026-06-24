import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { GcsStorageService } from './storage/gcs-storage.service';
import { S3StorageService } from './storage/s3-storage.service';
import { StorageService } from './storage/storage.abstract';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [
    UploadsService,
    {
      // The abstract class IS the DI token.
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageService => {
        const provider = (
          config.get<string>('STORAGE_PROVIDER') ?? 's3'
        ).toLowerCase();

        switch (provider) {
          case 's3': {
            const region = config.getOrThrow<string>('AWS_REGION');
            const accessKeyId = config.getOrThrow<string>('AWS_ACCESS_KEY_ID');
            const secretAccessKey = config.getOrThrow<string>(
              'AWS_SECRET_ACCESS_KEY',
            );
            const endpoint = config.get<string>('AWS_S3_ENDPOINT');
            const s3 = new S3Client({
              region,
              credentials: { accessKeyId, secretAccessKey },
              ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
            });
            return new S3StorageService(s3, config);
          }
          case 'gcs':
            return new GcsStorageService(config);
          default:
            throw new Error(
              `Unsupported STORAGE_PROVIDER "${provider}". Use "s3" or "gcs".`,
            );
        }
      },
    },
  ],
})
export class UploadsModule {}
