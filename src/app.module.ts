import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { ThrottlerBehindAuthGuard } from './common/guards/throttler-behind-auth.guard';
import { typeOrmAsyncConfig } from './config/typeorm.config';
import { HealthModule } from './health/health.module';
import { PostsModule } from './posts/posts.module';
import { ProfilesModule } from './profiles/profiles.module';
import { REDIS_CLIENT } from './redis/redis.constants';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { LikesModule } from './likes/likes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    // RedisModule is @Global(), so REDIS_CLIENT is injectable here without an imports entry.
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis): ThrottlerModuleOptions => ({
        throttlers: [
          {
            name: 'global',
            ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
            limit: parseInt(process.env.THROTTLE_LIMIT ?? '60', 10),
          },
        ],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
    AuthModule,
    HealthModule,
    UsersModule,
    PostsModule,
    ProfilesModule,
    UploadsModule,
    CommentsModule,
    LikesModule,
  ],
  providers: [
    // Runs before JwtAuthGuard (registered in main.ts via useGlobalGuards) so that
    // @Public() routes like /auth/login are still rate-limited per IP.
    { provide: APP_GUARD, useClass: ThrottlerBehindAuthGuard },
  ],
})
export class AppModule {}
