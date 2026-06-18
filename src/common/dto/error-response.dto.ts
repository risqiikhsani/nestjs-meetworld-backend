import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape of every error response produced by {@link HttpExceptionFilter}.
 * Used purely for OpenAPI schema generation; it is not returned by any
 * controller method directly.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    example: '2026-06-18T12:34:56.789Z',
    description: 'ISO-8601 timestamp the error was produced',
  })
  timestamp!: string;

  @ApiProperty({ example: '/api/users/not-a-uuid' })
  path!: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'User with id "not-a-uuid" was not found',
  })
  message!: string | string[];
}
