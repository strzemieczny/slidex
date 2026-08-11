import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  const configuredOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: configuredOrigins?.length ? configuredOrigins : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: Boolean(configuredOrigins?.length),
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  console.log(`🚀 Serwer SLIDEX działa na: http://localhost:${port}`);
}
bootstrap().catch((error: unknown) => {
  console.error('❌ Nie udało się uruchomić serwera SLIDEX', error);
  process.exit(1);
});
