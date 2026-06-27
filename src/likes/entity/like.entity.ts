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
import { Comment } from '../../comments/entities/comment.entity';
import { Post } from '../../posts/entities/post.entity';
import { User } from '../../users/entities/user.entity';

/**
 * One row per "user liked something". For now, `postId` is set and `commentId`
 * is NULL — comment-likes are a future addition. The composite unique index
 * `uq_likes_author_post` deduplicates (one like per user per post) and also
 * serves as a B-tree on `author_id` (leftmost prefix), so there is no separate
 * `idx_likes_author_id`.
 */
@Entity({ name: 'likes' })
@Index('idx_likes_post_id', ['postId'])
@Index('uq_likes_author_post', ['authorId', 'postId'], { unique: true })
export class Like {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'post_id', type: 'uuid' })
  postId!: string;

  // Nullable now so the comment-likes work later only has to start setting
  // this column — no schema change required.
  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ name: 'comment_id', type: 'uuid', nullable: true })
  commentId!: string | null;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, (user) => user.likes, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'author_id' })
  author!: User;

  @ApiProperty({ type: () => Post })
  @ManyToOne(() => Post, (post) => post.likes, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'post_id' })
  post!: Post;

  @ApiProperty({ type: () => Comment, required: false })
  @ManyToOne(() => Comment, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'comment_id' })
  comment?: Comment;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
