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

  it('constructs Storage without options (SDK auto-discovers credentials)', () => {
    const svc = new GcsStorageService(makeConfig({ GCS_BUCKET: 'my-bucket' }));
    expect(gcsMock.Storage).toHaveBeenCalledTimes(1);
    expect(gcsMock.Storage).toHaveBeenCalledWith();
    expect(svc).toBeInstanceOf(GcsStorageService);
  });

  it('does not read GOOGLE_CLOUD_PROJECT or GOOGLE_APPLICATION_CREDENTIALS from ConfigService', () => {
    const config = makeConfig({
      GCS_BUCKET: 'my-bucket',
      GOOGLE_CLOUD_PROJECT: 'should-be-ignored',
      GOOGLE_APPLICATION_CREDENTIALS: '/should-be-ignored.json',
    });
    new GcsStorageService(config);
    expect(gcsMock.Storage).toHaveBeenCalledWith();
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
