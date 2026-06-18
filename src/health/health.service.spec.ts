import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { HealthService } from './health.service';

type DataSourceMock = jest.Mocked<Pick<DataSource, 'query'>>;
type RedisMock = jest.Mocked<Pick<Redis, 'get' | 'set' | 'del' | 'ping'>>;

describe('HealthService', () => {
  let service: HealthService;
  let dataSource: DataSourceMock;
  let redis: RedisMock;

  beforeEach(async () => {
    dataSource = {
      query: jest.fn(),
    };
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      ping: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: DataSource, useValue: dataSource },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('returns ok status with database and redis up when both succeed', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockResolvedValue('PONG');

    const result = await service.check();

    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    expect(redis.ping).toHaveBeenCalled();
    expect(result.status).toBe('ok');
    expect(result.database).toEqual({ status: 'up' });
    expect(result.redis).toEqual({ status: 'up' });
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it('throws ServiceUnavailableException with degraded payload when the DB is down', async () => {
    dataSource.query.mockRejectedValue(new Error('connection refused'));
    redis.ping.mockResolvedValue('PONG');

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
        redis: { status: string };
      };
      expect(response.status).toBe('degraded');
      expect(response.database.status).toBe('down');
      expect(response.database.error).toBe('connection refused');
      expect(response.redis.status).toBe('up');
    }
  });

  it('falls back to a string coercion when the error is not an Error instance', async () => {
    dataSource.query.mockRejectedValue('boom');
    redis.ping.mockResolvedValue('PONG');

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns degraded with redis down when only redis fails', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockRejectedValue(new Error('econnrefused'));

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.database).toEqual({ status: 'up' });
    expect(result.redis).toEqual({
      status: 'down',
      error: 'econnrefused',
    });
  });

  it('returns degraded with unexpected reply when redis.ping does not return PONG', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockResolvedValue('WHAT');

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.redis).toEqual({
      status: 'down',
      error: 'unexpected PING reply: WHAT',
    });
  });
});
