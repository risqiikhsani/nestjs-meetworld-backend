import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { Comment } from '../comments/entities/comment.entity';
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
    // entities: [User, Post, Profile, Comment],
    autoLoadEntities: true, // 👈 Enables auto-loading
    subscribers: [UserSubscriber],

    // Development: synchronize: true can automatically update the database schema.
    // Production: Never use synchronize: true. Use TypeORM migrations instead.
    // example: npm run typeorm migration:generate src/database/migrations/AddPhoneToUser
    // synchronize: true,

    // 1. Turn this OFF
    synchronize: false,

    // 2. Add migrations configuration
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    // migrationsRun: true, // Automatically runs migrations on app startup (optional)

    logging: config.get<string>('NODE_ENV') === 'development',
  }),
};
