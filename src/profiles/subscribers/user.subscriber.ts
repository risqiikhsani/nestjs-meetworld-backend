import { Logger } from '@nestjs/common';
import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Profile } from '../entities/profile.entity';

@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {
  private readonly logger = new Logger(UserSubscriber.name);

  listenTo(): typeof User {
    return User;
  }

  async afterInsert(event: InsertEvent<User>): Promise<void> {
    const user = event.entity;
    if (!user?.id) {
      return;
    }
    await event.manager.save(Profile, { userId: user.id });
    this.logger.log(`Created empty profile for user ${user.id}`);
  }
}
