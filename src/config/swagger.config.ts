import { DocumentBuilder } from '@nestjs/swagger';

export const SWAGGER_BEARER_NAME = 'bearer';

/**
 * Builds the OpenAPI document config for the MeetWorld API.
 *
 * Exposed at `/api/docs` (see `SwaggerModule.setup('docs', ..., { useGlobalPrefix: true })`
 * in `main.ts`). Schemas are generated from the existing DTOs and entities — there
 * is no hand-written OpenAPI YAML.
 *
 * To authenticate from the UI: call `POST /api/auth/login` to obtain an
 * `access_token`, then paste it into the Authorize dialog as `Bearer <token>`.
 */
export function buildSwaggerConfig(): DocumentBuilder {
  return new DocumentBuilder()
    .setTitle('MeetWorld API')
    .setDescription(
      'REST API for the MeetWorld backend. Every route under `/api` (except ' +
        '`/api/auth/register`, `/api/auth/login`, `/api/health`) requires a ' +
        'JWT bearer token. Get one from `POST /api/auth/login` and paste it ' +
        'into the Authorize dialog as `Bearer <token>`.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT issued by `POST /api/auth/login`.',
      },
      SWAGGER_BEARER_NAME,
    )
    .addTag('auth', 'Registration and login (public).')
    .addTag('users', 'User CRUD.')
    .addTag('posts', 'Posts scoped under a user (`:userId/posts`).')
    .addTag(
      'comments',
      'Comments scoped under a post (`/posts/:postId/comments`).',
    )
    .addTag('profiles', 'Profile scoped under a user (`:userId/profile`).')
    .addTag('uploads', 'Multipart file uploads to S3.')
    .addTag('health', 'Liveness/readiness probe (public).');
}
