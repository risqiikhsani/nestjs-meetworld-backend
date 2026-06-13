import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

type DataSourceMock = jest.Mocked<Pick<DataSource, 'query'>>;

describe('HealthService', () => {
  let service: HealthService;
  let dataSource: DataSourceMock;

  beforeEach(async () => {
    dataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService, { provide: DataSource, useValue: dataSource }],
    }).compile();

    service = module.get(HealthService);
  });

  it('returns ok status with database up when SELECT 1 succeeds', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.check();

    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    expect(result.status).toBe('ok');
    expect(result.database).toEqual({ status: 'up' });
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it('throws ServiceUnavailableException with degraded payload when the DB is down', async () => {
    dataSource.query.mockRejectedValue(new Error('connection refused'));

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    try {
      await service.check();
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      const response = (err as ServiceUnavailableException).getResponse() as {
        status: string;
        database: { status: string; error: string };
      };
      expect(response.status).toBe('degraded');
      expect(response.database.status).toBe('down');
      expect(response.database.error).toBe('connection refused');
    }
  });

  it('falls back to a string coercion when the error is not an Error instance', async () => {
    dataSource.query.mockRejectedValue('boom');

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
