import 'reflect-metadata';
import { mkdirSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { uploadDir } from './uploads/image-upload';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false });
  const files = uploadDir();
  mkdirSync(files, { recursive: true });
  app.useStaticAssets(files, { prefix: '/uploads/' });
  app.setGlobalPrefix('api/v1');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.enableCors({
    origin: (process.env.WEB_ORIGIN || 'http://localhost:5173').split(','),
    credentials: true,
  });

  const swagger = new DocumentBuilder()
    .setTitle('CrickScore API')
    .setDescription('Versioned cricket scoring API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = Number(process.env.API_PORT || 4000);
  await app.listen(port);
  console.log(`CrickScore API http://localhost:${port}/api/v1  docs: /api/docs`);
}

void bootstrap();
