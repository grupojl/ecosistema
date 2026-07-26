import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Seguridad: CORS ───────────────────────────────────────────────────────
  // Si ALLOWED_ORIGINS no está definido o está vacío, el servidor NO arranca.
  // credentials: true con origin: '*' es una vulnerabilidad CORS activa.
  const rawOrigins = process.env['ALLOWED_ORIGINS'];
  if (!rawOrigins || rawOrigins.trim() === '') {
    throw new Error(
      '[real-back] Variable de entorno ALLOWED_ORIGINS no definida. ' +
      'Definila antes de arrancar el servidor (ej: http://localhost:3001,https://app.tudominio.com). ' +
      'El servidor no puede arrancar con CORS abierto.',
    );
  }
  const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // ── Seguridad: Helmet ─────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // ── Validación global ─────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Real Estate SaaS Backend running on port http://localhost:${port}`);
}

bootstrap();
