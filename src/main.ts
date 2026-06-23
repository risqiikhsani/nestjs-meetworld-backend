import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { buildSwaggerConfig } from './config/swagger.config';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // Build the OpenAPI document from the fully-configured app so every
  // @ApiTags / @ApiBearerAuth / @ApiProperty annotation is picked up.
  const swaggerConfig: DocumentBuilder = buildSwaggerConfig();
  const document = SwaggerModule.createDocument(app, swaggerConfig.build());
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });

  // automatically create openapi.json schema for testing
  fs.writeFileSync(
    path.join(__dirname, '../openapi.json'),
    JSON.stringify(document, null, 2),
  );

  const config = app.get(ConfigService);
  const port = parseInt(config.get<string>('PORT') ?? '3000', 10);

  await app.listen(port);
}
void bootstrap();
