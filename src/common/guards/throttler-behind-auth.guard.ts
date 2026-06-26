import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import type {
  ThrottlerStorage,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class ThrottlerBehindAuthGuard extends ThrottlerGuard {
  // Feature flag: when false, the throttler is a no-op for every request.
  // Read once at construction; changes to THROTTLE_ENABLED require a restart.
  private readonly enabled: boolean;

  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    configService: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.enabled =
      (
        configService.get<string>('THROTTLE_ENABLED') ?? 'false'
      ).toLowerCase() === 'true';
  }

  // 1. Feature flag — when disabled, skip throttling for every request. This
  //    also turns off the hardcoded per-route auth limits (5/min login,
  //    3/hr register) because they share this guard.
  // 2. Bypass CORS preflight requests so they do not consume throttler budget.
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method === 'OPTIONS') {
      return true;
    }
    return super.shouldSkip(context);
  }

  // Track by client IP (req.ip honors Express's `trust proxy` setting).
  protected getTracker(req: Request): Promise<string> {
    return Promise.resolve(req.ip ?? 'unknown');
  }
}
