import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'profiles' })
export class Profile {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @ApiProperty({ type: () => User })
  @OneToOne(() => User, (user) => user.profile, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ApiProperty({ nullable: true, maxLength: 1000 })
  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @ApiProperty({ nullable: true, format: 'uri', maxLength: 500 })
  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ nullable: true, maxLength: 100 })
  @Column({ type: 'varchar', length: 100, nullable: true })
  location!: string | null;

  @ApiProperty({
    nullable: true,
    format: 'date',
    example: '1995-04-12',
    description: 'ISO-8601 calendar date (YYYY-MM-DD).',
  })
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth!: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
