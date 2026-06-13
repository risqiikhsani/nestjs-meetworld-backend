import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { S3_CLIENT } from './uploads.constants';
import { UploadsService } from './uploads.service';

type S3Mock = jest.Mocked<Pick<S3Client, 'send' | 'config'>>;

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'sample.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 12,
    buffer: Buffer.from('hello'),
    ...overrides,
  };
}

describe('UploadsService', () => {
  let service: UploadsService;
  let s3: S3Mock;
  const config = {
    getOrThrow: jest.fn((key: string) =>
      key === 'AWS_S3_BUCKET' ? 'test-bucket' : undefined,
    ),
  } as unknown as ConfigService;

  beforeEach(async () => {
    s3 = {
      send: jest.fn().mockResolvedValue({}),
      config: { region: () => 'us-east-1' },
    } as unknown as S3Mock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: S3_CLIENT, useValue: s3 },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(UploadsService);
  });

  it('uploadOne sends a PutObjectCommand with public-read ACL and returns the public URL', async () => {
    const file = makeFile();
    const url = await service.uploadOne(file);

    expect(s3.send).toHaveBeenCalledTimes(1);
    const command = s3.send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Bucket).toBe('test-bucket');
    expect(command.input.ACL).toBe('public-read');
    expect(command.input.Body).toBe(file.buffer);
    expect(command.input.ContentType).toBe('image/png');
    expect(command.input.Key).toMatch(
      /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.png$/,
    );
    expect(url).toBe(
      `https://test-bucket.s3.us-east-1.amazonaws.com/${command.input.Key}`,
    );
  });

  it('uploadMany calls send once per file and returns URLs in the same order', async () => {
    const files = [
      makeFile(),
      makeFile({ originalname: 'b.jpg', mimetype: 'image/jpeg' }),
    ];
    const urls = await service.uploadMany(files);

    expect(s3.send).toHaveBeenCalledTimes(2);
    expect(urls).toHaveLength(2);
    for (const u of urls) {
      expect(u).toMatch(
        /^https:\/\/test-bucket\.s3\.us-east-1\.amazonaws\.com\//,
      );
    }
    const keys = (s3.send.mock.calls as Array<[PutObjectCommand]>).map(
      ([cmd]) => cmd.input.Key as string,
    );
    expect(keys[0]).toMatch(/\.png$/);
    expect(keys[1]).toMatch(/\.jpg$/);
  });

  it('uploadOne propagates S3 errors', async () => {
    s3.send.mockRejectedValueOnce(new Error('AccessDenied'));
    await expect(service.uploadOne(makeFile())).rejects.toThrow('AccessDenied');
  });
});
