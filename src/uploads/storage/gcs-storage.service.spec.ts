import { ConfigService } from '@nestjs/config';

jest.mock('@google-cloud/storage', () => {
  const save: jest.Mock = jest.fn();
  const file: jest.Mock = jest.fn(() => ({ save }));
  const bucket: jest.Mock = jest.fn(() => ({ file }));
  const Storage: jest.Mock = jest.fn(() => ({ bucket }));
  return { Storage, __save: save, __file: file, __bucket: bucket };
});

import { GcsStorageService } from './gcs-storage.service';

const gcsMock = jest.requireMock('@google-cloud/storage') as unknown as {
  Storage: jest.Mock;
  __save: jest.Mock;
  __file: jest.Mock;
  __bucket: jest.Mock;
};

function makeConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (values[key] === undefined) {
        throw new Error(`Config error: ${key}`);
      }
      return values[key];
    }),
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('GcsStorageService', () => {
  beforeEach(() => {
    gcsMock.Storage.mockClear();
    gcsMock.__save.mockClear();
    gcsMock.__file.mockClear();
    gcsMock.__bucket.mockClear();
    gcsMock.__save.mockResolvedValue(undefined);
  });

  it('throws if GCS_BUCKET is missing', () => {
    expect(() => new GcsStorageService(makeConfig({}))).toThrow(/GCS_BUCKET/);
  });

  it('constructs Storage without projectId or keyFilename when none are set', () => {
    const svc = new GcsStorageService(makeConfig({ GCS_BUCKET: 'my-bucket' }));
    expect(gcsMock.Storage).toHaveBeenCalledTimes(1);
    expect(gcsMock.Storage).toHaveBeenCalledWith({});
    expect(svc).toBeInstanceOf(GcsStorageService);
  });

  it('passes projectId and keyFilename from GCS_* vars when present', () => {
    new GcsStorageService(
      makeConfig({
        GCS_BUCKET: 'my-bucket',
        GCS_PROJECT_ID: 'my-project',
        GCS_KEY_FILENAME: '/path/to/sa.json',
      }),
    );
    expect(gcsMock.Storage).toHaveBeenCalledWith({
      projectId: 'my-project',
      keyFilename: '/path/to/sa.json',
    });
  });

  it('falls back to GOOGLE_CLOUD_PROJECT when GCS_PROJECT_ID is unset', () => {
    new GcsStorageService(
      makeConfig({
        GCS_BUCKET: 'my-bucket',
        GOOGLE_CLOUD_PROJECT: 'gcp-fallback-project',
      }),
    );
    expect(gcsMock.Storage).toHaveBeenCalledWith({
      projectId: 'gcp-fallback-project',
    });
  });

  it('prefers GCS_PROJECT_ID over GOOGLE_CLOUD_PROJECT', () => {
    new GcsStorageService(
      makeConfig({
        GCS_BUCKET: 'my-bucket',
        GCS_PROJECT_ID: 'explicit',
        GOOGLE_CLOUD_PROJECT: 'fallback',
      }),
    );
    expect(gcsMock.Storage).toHaveBeenCalledWith({ projectId: 'explicit' });
  });

  it('falls back to GOOGLE_APPLICATION_CREDENTIALS when GCS_KEY_FILENAME is unset', () => {
    new GcsStorageService(
      makeConfig({
        GCS_BUCKET: 'my-bucket',
        GOOGLE_APPLICATION_CREDENTIALS: '/path/from/adc.json',
      }),
    );
    expect(gcsMock.Storage).toHaveBeenCalledWith({
      keyFilename: '/path/from/adc.json',
    });
  });

  it('prefers GCS_KEY_FILENAME over GOOGLE_APPLICATION_CREDENTIALS', () => {
    new GcsStorageService(
      makeConfig({
        GCS_BUCKET: 'my-bucket',
        GCS_KEY_FILENAME: '/explicit.json',
        GOOGLE_APPLICATION_CREDENTIALS: '/adc.json',
      }),
    );
    expect(gcsMock.Storage).toHaveBeenCalledWith({
      keyFilename: '/explicit.json',
    });
  });

  it('upload calls bucket().file().save() with the right args and returns the public URL', async () => {
    const svc = new GcsStorageService(makeConfig({ GCS_BUCKET: 'my-bucket' }));

    const body = Buffer.from('hello');
    const url = await svc.upload('2026-06-24/abc.png', body, 'image/png');

    expect(gcsMock.__bucket).toHaveBeenCalledWith('my-bucket');
    expect(gcsMock.__file).toHaveBeenCalledWith('2026-06-24/abc.png');
    expect(gcsMock.__save).toHaveBeenCalledWith(body, {
      contentType: 'image/png',
      resumable: false,
    });
    expect(url).toBe(
      'https://storage.googleapis.com/my-bucket/2026-06-24/abc.png',
    );
  });

  it('propagates save errors', async () => {
    gcsMock.__save.mockRejectedValueOnce(new Error('GCS 403'));
    const svc = new GcsStorageService(makeConfig({ GCS_BUCKET: 'my-bucket' }));

    await expect(
      svc.upload('2026-06-24/abc.png', Buffer.from('hi'), 'image/png'),
    ).rejects.toThrow('GCS 403');
  });
});
