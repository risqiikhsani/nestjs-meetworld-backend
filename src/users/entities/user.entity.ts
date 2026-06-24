import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { Profile } from '../../profiles/entities/profile.entity';

@Entity({ name: 'users' })
export class User {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: 'alice@example.com', maxLength: 120 })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  email!: string;

  @ApiProperty({ example: 'Alice', maxLength: 80 })
  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @ApiProperty({
    description:
      'bcrypt hash. Documented here for completeness; stripped from JSON ' +
      'responses by the global `ClassSerializerInterceptor` (@Exclude).',
    nullable: true,
    minLength: 60,
    maxLength: 60,
  })
  // This ensures the field is completely ignored unless explicitly requested
  @Exclude({ toPlainOnly: true })
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 60,
    nullable: true,
    select: false, // <-- Combined here cleanly
  })
  passwordHash!: string | null;

  @ApiProperty({ nullable: true, format: 'uri', maxLength: 500 })
  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ type: () => Profile, required: false })
  @OneToOne(() => Profile, (profile) => profile.user, { cascade: false })
  profile?: Profile;

  @ApiProperty({ type: () => Post, isArray: true })
  @OneToMany(() => Post, (post) => post.author, { cascade: false })
  posts!: Post[];

  @ApiProperty({ type: () => Comment, isArray: true })
  @OneToMany(() => Comment, (comment) => comment.author, { cascade: false })
  comments!: Comment[];

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
