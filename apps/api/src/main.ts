import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const openApiConfig = new DocumentBuilder()
    .setTitle('KLIKS API')
    .setDescription('Development API. No real banking or payment processing is available.')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, openApiConfig));

  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}

void bootstrap();