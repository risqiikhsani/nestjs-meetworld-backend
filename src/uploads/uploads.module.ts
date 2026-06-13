import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { S3_CLIENT } from './uploads.constants';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [
    UploadsService,
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): S3Client => {
        const region = config.getOrThrow<string>('AWS_REGION');
        const accessKeyId = config.getOrThrow<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = config.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY',
        );
        const endpoint = config.get<string>('AWS_S3_ENDPOINT');

        return new S3Client({
          region,
          credentials: { accessKeyId, secretAccessKey },
          ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
        });
      },
    },
  ],
})
export class UploadsModule {}
