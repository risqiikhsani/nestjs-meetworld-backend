import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { HealthCheckDto } from './health.dto';
import { HealthCheck, HealthService } from './health.service';

@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Liveness/readiness probe (DB + Redis). Public.',
  })
  @ApiOkResponse({ type: HealthCheckDto })
  check(): Promise<HealthCheck> {
    return this.healthService.check();
  }
}
