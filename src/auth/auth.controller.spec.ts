import 'reflect-metadata';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

// @Throttle() in @nestjs/throttler stores metadata under `THROTTLER:LIMIT<name>`
// and `THROTTLER:TTL<name>` via raw reflect-metadata. Reading them with raw
// `Reflect.getMetadata` keeps this spec free of Nest's Reflector plumbing
// while still verifying the decorators are wired to the right handlers.
const LIMIT_KEY = 'THROTTLER:LIMITdefault';
const TTL_KEY = 'THROTTLER:TTLdefault';

describe('AuthController @Throttle metadata', () => {
  it('register handler carries the 3-per-hour limit', () => {
    const limit = Reflect.getMetadata(
      LIMIT_KEY,
      AuthController.prototype.register,
    );
    const ttl = Reflect.getMetadata(
      TTL_KEY,
      AuthController.prototype.register,
    );

    expect(limit).toBe(3);
    expect(ttl).toBe(3_600_000);
  });

  it('login handler carries the 5-per-minute limit', () => {
    const limit = Reflect.getMetadata(
      LIMIT_KEY,
      AuthController.prototype.login,
    );
    const ttl = Reflect.getMetadata(TTL_KEY, AuthController.prototype.login);

    expect(limit).toBe(5);
    expect(ttl).toBe(60_000);
  });

  it('updatePassword handler carries no throttler override (falls under global cap)', () => {
    const limit = Reflect.getMetadata(
      LIMIT_KEY,
      AuthController.prototype.updatePassword,
    );
    const ttl = Reflect.getMetadata(
      TTL_KEY,
      AuthController.prototype.updatePassword,
    );

    expect(limit).toBeUndefined();
    expect(ttl).toBeUndefined();
  });

  it('instantiates with the AuthService dependency', () => {
    const controller = new AuthController({} as AuthService);
    expect(controller).toBeInstanceOf(AuthController);
  });
});