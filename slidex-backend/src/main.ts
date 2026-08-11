import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(3000);
  console.log(`🚀 Serwer SLIDEX działa na: http://localhost:3000`);
}
bootstrap().catch((error: unknown) => {
  console.error('❌ Nie udało się uruchomić serwera SLIDEX', error);
  process.exit(1);
});
