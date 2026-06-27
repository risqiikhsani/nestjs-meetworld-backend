import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsModule } from '../posts/posts.module';
import { RedisModule } from '../redis/redis.module';
import { UsersModule } from '../users/users.module';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';
import { Like } from './entity/like.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Like]),
    UsersModule,
    PostsModule,
    RedisModule,
  ],
  controllers: [LikesController],
  providers: [LikesService],
  exports: [LikesService],
})
export class LikesModule {}
