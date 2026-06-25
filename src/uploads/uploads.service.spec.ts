import { Test, TestingModule } from '@nestjs/testing';
import { UploadsService } from './uploads.service';
import { StorageService } from './storage/storage.abstract';

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
  let storage: jest.Mocked<Pick<StorageService, 'upload'>>;

  beforeEach(async () => {
    storage = { upload: jest.fn() };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = mod.get(UploadsService);
  });

  it('uploadOne generates a dated/uuid key and delegates to storage', async () => {
    storage.upload.mockResolvedValue('https://example/x');
    const file = makeFile();

    const result = await service.uploadOne(file);

    expect(storage.upload).toHaveBeenCalledTimes(1);
    const [key, body, ct] = storage.upload.mock.calls[0];
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(body).toBe(file.buffer);
    expect(ct).toBe('image/png');
    expect(result).toEqual({ url: 'https://example/x' });
  });

  it('uploadMany preserves order and calls storage per file', async () => {
    storage.upload
      .mockResolvedValueOnce('https://a/1')
      .mockResolvedValueOnce('https://a/2');

    const result = await service.uploadMany([
      makeFile(),
      makeFile({ originalname: 'b.jpg', mimetype: 'image/jpeg' }),
    ]);

    expect(result).toEqual({ urls: ['https://a/1', 'https://a/2'] });
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(storage.upload.mock.calls[1][0]).toMatch(/\.jpg$/);
  });

  it('uploadOne propagates storage errors', async () => {
    storage.upload.mockRejectedValueOnce(new Error('boom'));
    await expect(service.uploadOne(makeFile())).rejects.toThrow('boom');
  });
});
