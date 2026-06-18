import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'posts' })
@Index('idx_posts_author_id', ['authorId'])
export class Post {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    type: [String],
    nullable: true,
    description:
      'S3 URLs attached to this post (populated by the upload flow).',
    example: [
      'https://meetworld-uploads.s3.us-east-1.amazonaws.com/2026-06-18/abc.jpg',
    ],
  })
  @Column('text', { array: true, nullable: true })
  images!: string[];

  @ApiProperty({ example: 'Hello, world', maxLength: 200 })
  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @ApiProperty({ example: 'First post on MeetWorld.' })
  @Column({ type: 'text' })
  body!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, (user) => user.posts, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'author_id' })
  author!: User;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
