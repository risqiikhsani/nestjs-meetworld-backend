import { ApiProperty } from '@nestjs/swagger';
import { Post } from '../entities/post.entity';

/**
 * Response shape of `GET /api/posts/feed`. `nextCursor` is `null` when the
 * caller has reached the end of the feed; otherwise pass it back as the
 * `cursor` query parameter on the next request.
 */
export class FeedResponseDto {
  @ApiProperty({ type: () => Post, isArray: true })
  items!: Post[];

  @ApiProperty({
    description:
      'Opaque token to pass as `cursor` to fetch the next page. `null` when ' +
      'there are no more posts.',
    nullable: true,
    example: 'eyJ0IjoiMjAyNi0wNi0xOFQxMjozNDoxNloifQ',
  })
  nextCursor!: string | null;
}
