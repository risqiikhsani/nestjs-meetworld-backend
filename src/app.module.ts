import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from './config/typeorm.config';
import { HealthModule } from './health/health.module';
import { PostsModule } from './posts/posts.module';
import { ProfilesModule } from './profiles/profiles.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    HealthModule,
    UsersModule,
    PostsModule,
    ProfilesModule,
    UploadsModule,
  ],
})
export class AppModule {}
