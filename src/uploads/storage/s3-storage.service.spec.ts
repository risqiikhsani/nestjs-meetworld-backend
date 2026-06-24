import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { S3StorageService } from './s3-storage.service';

type S3Mock = jest.Mocked<Pick<S3Client, 'send' | 'config'>>;

function makeConfig(bucket: string | undefined): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'AWS_S3_BUCKET') {
        if (bucket === undefined) {
          throw new Error(`Config error: ${key}`);
        }
        return bucket;
      }
      return undefined;
    }),
  } as unknown as ConfigService;
}

function makeS3(region: string | undefined): S3Mock {
  return {
    send: jest.fn().mockResolvedValue({}),
    config: { region: () => Promise.resolve(region) },
  } as unknown as S3Mock;
}

describe('S3StorageService', () => {
  it('throws if AWS_S3_BUCKET is missing', () => {
    expect(
      () => new S3StorageService(makeS3('us-east-1'), makeConfig(undefined)),
    ).toThrow(/AWS_S3_BUCKET/);
  });

  it('upload sends a PutObjectCommand with public-read ACL and returns the public URL', async () => {
    const s3 = makeS3('us-east-1');
    const svc = new S3StorageService(s3, makeConfig('test-bucket'));

    const url = await svc.upload(
      '2026-06-24/abc.png',
      Buffer.from('hi'),
      'image/png',
    );

    expect(s3.send).toHaveBeenCalledTimes(1);
    const command = s3.send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Bucket).toBe('test-bucket');
    expect(command.input.ACL).toBe('public-read');
    expect(command.input.Body).toEqual(Buffer.from('hi'));
    expect(command.input.ContentType).toBe('image/png');
    expect(command.input.Key).toBe('2026-06-24/abc.png');
    expect(url).toBe(
      'https://test-bucket.s3.us-east-1.amazonaws.com/2026-06-24/abc.png',
    );
  });

  it('throws when S3 client has no region configured', async () => {
    const s3 = makeS3(undefined);
    const svc = new S3StorageService(s3, makeConfig('test-bucket'));

    await expect(
      svc.upload('2026-06-24/abc.png', Buffer.from('hi'), 'image/png'),
    ).rejects.toThrow(/no region configured/);
  });

  it('propagates S3 errors', async () => {
    const s3 = makeS3('us-east-1');
    s3.send.mockRejectedValueOnce(new Error('AccessDenied'));
    const svc = new S3StorageService(s3, makeConfig('test-bucket'));

    await expect(
      svc.upload('2026-06-24/abc.png', Buffer.from('hi'), 'image/png'),
    ).rejects.toThrow('AccessDenied');
  });
});
