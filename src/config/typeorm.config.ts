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
    url: config.getOrThrow<string>('DATABASE_URL'),
    entities: [User, Post, Profile],
    subscribers: [UserSubscriber],

    // Development: synchronize: true can automatically update the database schema.
    // Production: Never use synchronize: true. Use TypeORM migrations instead.
    // example: npm run typeorm migration:generate src/database/migrations/AddPhoneToUser
    synchronize: true,

    logging: config.get<string>('NODE_ENV') === 'development',
  }),
};
