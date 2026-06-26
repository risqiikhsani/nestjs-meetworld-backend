import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../redis/redis.constants';

export interface HealthCheck {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  database: {
    status: 'up' | 'down';
    error?: string;
  };
  redis: {
    status: 'up' | 'down';
    error?: string;
  };
}

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthCheck> {
    const [database, redis] = await Promise.all([
      this.pingDatabase(),
      this.pingRedis(),
    ]);
    const status: HealthCheck['status'] =
      database.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded';

    return {
      status,
      uptime: Math.round((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      database,
      redis,
    };
  }

  private async pingDatabase(): Promise<HealthCheck['database']> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ServiceUnavailableException({
        status: 'degraded',
        uptime: Math.round((Date.now() - this.startedAt) / 1000),
        timestamp: new Date().toISOString(),
        database: { status: 'down', error: message },
        redis: { status: 'up' },
      });
    }
  }

  private async pingRedis(): Promise<HealthCheck['redis']> {
    try {
      const reply = await this.redis.ping();
      if (reply !== 'PONG') {
        return {
          status: 'down',
          error: `unexpected PING reply: ${String(reply)}`,
        };
      }
      return { status: 'up' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'down', error: message };
    }
  }
}
