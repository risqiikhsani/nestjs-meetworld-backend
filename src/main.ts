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

  app.enableCors({
    origin: true, 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

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

  const swaggerConfig: DocumentBuilder = buildSwaggerConfig();
  const document = SwaggerModule.createDocument(app, swaggerConfig.build());
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });

  // Automatically create openapi.json schema
  // (Using process.cwd() ensures it writes safely relative to the project root directory)
  try {
    fs.writeFileSync(
      path.join(process.cwd(), 'openapi.json'),
      JSON.stringify(document, null, 2),
    );
  } catch (error) {
    console.warn('Failed to write openapi.json:', error);
  }

  const config = app.get(ConfigService);
  
  // 💡 CLOUD RUN FIX 1: Prioritize process.env.PORT over config service defaults, 
  // because Cloud Run injects it directly into the environment.
  const port = parseInt(process.env.PORT || config.get<string>('PORT') || '8080', 10);

  // 💡 CLOUD RUN FIX 2: Explicitly pass '0.0.0.0' as the host.
  await app.listen(port, '0.0.0.0');
  
  console.log(`Application is running on port ${port} bound to 0.0.0.0`);
}

void bootstrap();