import { NestFactory }    from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet             from 'helmet';
import cookieParser       from 'cookie-parser';
import { AppModule }      from './app.module';

// ── Validación de variables de entorno requeridas ─────────────────────────────
// Fail-fast: el servicio no arranca con configuración incompleta.
// Un arranque con vars faltantes causaría errores silenciosos en runtime.
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'ALLOWED_ORIGINS',
] as const;

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    console.error(`[realsass-sass-back] FATAL: Variable de entorno requerida faltante: ${key}`);
    console.error('[realsass-sass-back] Copiar .env.example a .env y completar los valores.');
    process.exit(1);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Seguridad: CORS ───────────────────────────────────────────────────────
  // ALLOWED_ORIGINS requerido — validado arriba.
  // credentials: true requerido para cookies HttpOnly (ADR-004).
  const allowedOrigins = process.env['ALLOWED_ORIGINS']!
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin:      allowedOrigins,
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id', 'x-internal-api-key'],
  });

  // ── Cookie parser — requerido para leer __session (ADR-004) ───────────────
  app.use(cookieParser());

  // ── Seguridad: Helmet ─────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: false, // tRPC + Next.js manejan CSP en el front
  }));

  // ── Validación global ─────────────────────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({
    whitelist:        true,
    forbidNonWhitelisted: true,
    transform:        true,
  }));

  // ── Swagger ───────────────────────────────────────────────────────────────
  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('realsass-sass-back')
      .setDescription('API de identidad, organizaciones y configuración')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  const port = parseInt(process.env['PORT'] ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`[realsass-sass-back] Escuchando en puerto ${port}`);
}

bootstrap().catch(err => {
  console.error('[realsass-sass-back] Error fatal al arrancar:', err);
  process.exit(1);
});
