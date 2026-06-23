import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 50;

/**
 * Query string for `GET /api/posts/feed`. Uses opaque cursor pagination:
 * `cursor` is a base64url-encoded `{ createdAt, id }` from the previous
 * page's `nextCursor`. Clients should treat it as opaque and never parse it.
 */
export class FeedQueryDto {
  @ApiProperty({
    description:
      'Opaque pagination token returned as `nextCursor` from the previous ' +
      'page. Omit to fetch the most recent page.',
    required: false,
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({
    description: `Page size. Defaults to ${FEED_DEFAULT_LIMIT}, max ${FEED_MAX_LIMIT}.`,
    required: false,
    default: FEED_DEFAULT_LIMIT,
    minimum: 1,
    maximum: FEED_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FEED_MAX_LIMIT)
  limit?: number;
}
