import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class StorageService {
  /**
   * Upload bytes under the given object key and return a public,
   * unauthenticated URL that can be embedded in client responses.
   *
   * The orchestrator (`UploadsService`) owns key generation; strategies are
   * pure "write bytes, return URL" implementations.
   */
  abstract upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string>;
}
