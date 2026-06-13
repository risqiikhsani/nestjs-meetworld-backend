import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface HealthCheck {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  database: {
    status: 'up' | 'down';
    error?: string;
  };
}

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(private readonly dataSource: DataSource) {}

  async check(): Promise<HealthCheck> {
    const database = await this.pingDatabase();
    const status: HealthCheck['status'] =
      database.status === 'up' ? 'ok' : 'degraded';

    return {
      status,
      uptime: Math.round((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      database,
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
      });
    }
  }
}
