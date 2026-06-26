import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { ThrottlerBehindAuthGuard } from './throttler-behind-auth.guard';

type ReflectorStub = {
  getAllAndOverride: jest.Mock;
};

function makeContext(method: string, ip?: string): ExecutionContext {
  const request: Record<string, unknown> = { method };
  if (ip !== undefined) request.ip = ip;
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
      getResponse: jest.fn(),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(env: Record<string, string | undefined> = {}): {
  guard: ThrottlerBehindAuthGuard;
  superShouldSkip: jest.SpyInstance;
  superGetTracker: jest.SpyInstance;
} {
  const reflector: ReflectorStub = { getAllAndOverride: jest.fn() };
  const options = { throttlers: [] };
  const storageService = { increment: jest.fn() };
  const configService = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;

  const guard = new ThrottlerBehindAuthGuard(
    options,
    storageService,
    reflector as never,
    configService,
  );

  const superShouldSkip = jest
    .spyOn(
      Object.getPrototypeOf(ThrottlerBehindAuthGuard.prototype),
      'shouldSkip',
    )
    .mockResolvedValue(false);
  const superGetTracker = jest
    .spyOn(
      Object.getPrototypeOf(ThrottlerBehindAuthGuard.prototype),
      'getTracker',
    )
    .mockResolvedValue('super-tracker');

  return { guard, superShouldSkip, superGetTracker };
}

describe('ThrottlerBehindAuthGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldSkip', () => {
    it('returns true for OPTIONS (CORS preflight) without calling super', async () => {
      const { guard, superShouldSkip } = makeGuard();
      const ctx = makeContext('OPTIONS');

      const result = await guard.shouldSkip(ctx);

      expect(result).toBe(true);
      expect(superShouldSkip).not.toHaveBeenCalled();
    });

    it('defaults to disabled when THROTTLE_ENABLED is unset (no super call)', async () => {
      const { guard, superShouldSkip } = makeGuard({});
      const ctx = makeContext('POST');

      const result = await guard.shouldSkip(ctx);

      expect(result).toBe(true);
      expect(superShouldSkip).not.toHaveBeenCalled();
    });

    it('treats THROTTLE_ENABLED=true as enabled and delegates to super', async () => {
      const { guard, superShouldSkip } = makeGuard({
        THROTTLE_ENABLED: 'true',
      });
      const ctx = makeContext('POST');

      const result = await guard.shouldSkip(ctx);

      expect(result).toBe(false);
      expect(superShouldSkip).toHaveBeenCalledWith(ctx);
    });

    it('returns true for every request when THROTTLE_ENABLED=false (no super call)', async () => {
      const { guard, superShouldSkip } = makeGuard({
        THROTTLE_ENABLED: 'false',
      });
      const ctx = makeContext('POST');

      const result = await guard.shouldSkip(ctx);

      expect(result).toBe(true);
      expect(superShouldSkip).not.toHaveBeenCalled();
    });
  });

  describe('getTracker', () => {
    it('returns req.ip when present', async () => {
      const { guard } = makeGuard();
      const ctx = makeContext('GET', '203.0.113.7');
      const req = ctx.switchToHttp().getRequest();

      const tracker = await guard.getTracker(req as never);

      expect(tracker).toBe('203.0.113.7');
    });

    it('falls back to "unknown" when req.ip is missing', async () => {
      const { guard } = makeGuard();
      const ctx = makeContext('GET');
      const req = ctx.switchToHttp().getRequest();

      const tracker = await guard.getTracker(req as never);

      expect(tracker).toBe('unknown');
    });
  });
});
