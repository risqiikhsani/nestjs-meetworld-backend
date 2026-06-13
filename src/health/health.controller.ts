import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): Promise<HealthCheck> {
    return this.healthService.check();
  }
}
