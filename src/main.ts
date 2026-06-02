import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((err) =>
          Object.values(err.constraints || {}).join(', '),
        );
        const { BadRequestException } = require('@nestjs/common');
        return new BadRequestException(messages);
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('DailyBake API')
    .setDescription('API Documentation DailyBake — Pre-order Dessert & Bakery')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`DailyBake API running on: http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();