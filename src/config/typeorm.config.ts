import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { Post } from '../posts/entities/post.entity';
import { Profile } from '../profiles/entities/profile.entity';
import { UserSubscriber } from '../profiles/subscribers/user.subscriber';
import { User } from '../users/entities/user.entity';

export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres' as const,
    host: config.getOrThrow<string>('DB_HOST'),
    port: parseInt(config.getOrThrow<string>('DB_PORT'), 10),
    username: config.getOrThrow<string>('DB_USERNAME'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database: config.getOrThrow<string>('DB_NAME'),
    entities: [User, Post, Profile],
    subscribers: [UserSubscriber],
    synchronize: true,
    logging: config.get<string>('NODE_ENV') === 'development',
  }),
};
