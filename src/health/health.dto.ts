import { ApiProperty } from '@nestjs/swagger';

export class HealthDependencyDto {
  @ApiProperty({ enum: ['up', 'down'] })
  status!: 'up' | 'down';

  @ApiProperty({ required: false })
  error?: string;
}

export class HealthCheckDto {
  @ApiProperty({ enum: ['ok', 'degraded'] })
  status!: 'ok' | 'degraded';

  @ApiProperty({ description: 'Process uptime in seconds.', example: 42 })
  uptime!: number;

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;

  @ApiProperty({ type: HealthDependencyDto })
  database!: HealthDependencyDto;

  @ApiProperty({ type: HealthDependencyDto })
  redis!: HealthDependencyDto;
}
