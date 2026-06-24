import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage, StorageOptions } from '@google-cloud/storage';
import { StorageService } from './storage.abstract';

@Injectable()
export class GcsStorageService extends StorageService {
  private readonly gcs: Storage;
  private readonly bucketName: string;

  constructor(config: ConfigService) {
    super();
    this.bucketName = config.getOrThrow<string>('GCS_BUCKET');

    const projectId =
      config.get<string>('GCS_PROJECT_ID') ??
      config.get<string>('GOOGLE_CLOUD_PROJECT');

    const keyFilename =
      config.get<string>('GCS_KEY_FILENAME') ??
      config.get<string>('GOOGLE_APPLICATION_CREDENTIALS');

    const opts: StorageOptions = {
      ...(projectId ? { projectId } : {}),
      ...(keyFilename ? { keyFilename } : {}),
    };
    this.gcs = new Storage(opts);
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    const file = this.gcs.bucket(this.bucketName).file(key);
    // Bucket is assumed public (allUsers → objectViewer). If not, the
    // returned URL will 403 — that is a deployment concern, not a code
    // concern, so we don't try to make the object public here.
    await file.save(body, { contentType, resumable: false });
    return `https://storage.googleapis.com/${this.bucketName}/${key}`;
  }
}
