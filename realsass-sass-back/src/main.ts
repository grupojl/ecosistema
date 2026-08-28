import { NestFactory }      from '@nestjs/core';
import { ValidationPipe }   from '@nestjs/common';
import helmet               from 'helmet';
import cookieParser         from 'cookie-parser';
import { AppModule }        from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Seguridad: CORS ───────────────────────────────────────────────────────
  // ALLOWED_ORIGINS requerido — sin él el servidor no arranca.
  // credentials: true + origin explícito → compatible con cookies HttpOnly (ADR-004).
  // credentials: true con origin: '*' es una vulnerabilidad CORS activa.
  const rawOrigins = process.env.ALLOWED_ORIGINS ?? '';
  if (!rawOrigins) {
    throw new Error('ALLOWED_ORIGINS no está definida — el servidor no puede arrancar sin CORS configurado');
  }
  const allowedOrigins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

  app.enableCors({
    origin:      allowedOrigins,
    credentials: true,  // requerido para cookies HttpOnly (ADR-004)
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-organization-id',
      'x-trpc-source',
    ],
  });

  // ── Cookie parser — requerido para leer __session (ADR-004) ───────────────
  app.use(cookieParser());

  // ── Seguridad: Helmet ─────────────────────────────────────────────────────
  app.use(helmet());

  // ── Validación global ─────────────────────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({
    whitelist:        true,
    forbidNonWhitelisted: true,
    transform:        true,
  }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
