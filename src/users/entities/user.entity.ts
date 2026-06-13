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
import { Profile } from '../../profiles/entities/profile.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  email!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Exclude({ toPlainOnly: true })
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  passwordHash!: string | null;

  @OneToOne(() => Profile, (profile) => profile.user, { cascade: false })
  profile?: Profile;

  @OneToMany(() => Post, (post) => post.author, { cascade: false })
  posts!: Post[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
