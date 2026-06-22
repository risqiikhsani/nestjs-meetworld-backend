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
import { Post } from '../../posts/entities/post.entity';

@Entity({ name: 'comments' })
@Index('idx_comments_post_id', ['postId'])
export class Comment {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: 'My comment to this post', maxLength: 200 })
  @Column({ type: 'varchar', length: 200 })
  text!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid', name: 'post_id' })
  postId!: string;

  @ApiProperty({ type: () => Post })
  @ManyToOne(() => Post, (post) => post.comments, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'post_id' })
  post!: Post;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, (user) => user.comments, {
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

  // @Column()
  // likes!: number;

  // @Column()
  // shares!: number;
}
