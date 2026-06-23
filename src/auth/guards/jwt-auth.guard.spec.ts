import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

type ReflectorStub = {
  getAllAndOverride: jest.Mock;
};

function makeContext(): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ method: 'GET' }),
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('returns true without invoking the parent guard when handler is marked @Public()', () => {
    const reflector: ReflectorStub = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    };

    const guard = new JwtAuthGuard(reflector as never);
    const superSpy = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    const ctx = makeContext();
    const result = guard.canActivate(ctx);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    expect(result).toBe(true);
    expect(superSpy).not.toHaveBeenCalled();
  });

  it('falls through to the parent guard when not marked @Public()', () => {
    const reflector: ReflectorStub = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };

    const guard = new JwtAuthGuard(reflector as never);
    const superSpy = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    const ctx = makeContext();
    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(superSpy).toHaveBeenCalledWith(ctx);
  });
});
