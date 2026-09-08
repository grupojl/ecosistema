import { NestFactory }    from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet             from 'helmet';
import { AppModule }      from './app.module';

// ── Validación de variables de entorno requeridas ─────────────────────────────
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'ALLOWED_ORIGINS',
] as const;

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    console.error(`[realsass-ecommerce-back] FATAL: Variable de entorno requerida faltante: ${key}`);
    console.error('[realsass-ecommerce-back] Copiar .env.example a .env y completar los valores.');
    process.exit(1);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Seguridad: CORS ───────────────────────────────────────────────────────
  const allowedOrigins = process.env['ALLOWED_ORIGINS']!
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin:      allowedOrigins,
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id', 'x-customer-id'],
  });

  // ── Seguridad: Helmet ─────────────────────────────────────────────────────
  app.use(helmet({ contentSecurityPolicy: false }));

  // ── Validación global ─────────────────────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({
    whitelist:            true,
    forbidNonWhitelisted: true,
    transform:            true,
  }));

  // ── Swagger (solo en dev) ─────────────────────────────────────────────────
  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('realsass-ecommerce-back')
      .setDescription('API de catálogo, órdenes, carrito y storefront')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  const port = parseInt(process.env['PORT'] ?? '3001', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`[realsass-ecommerce-back] Escuchando en puerto ${port}`);
}

bootstrap().catch(err => {
  console.error('[realsass-ecommerce-back] Error fatal al arrancar:', err);
  process.exit(1);
});
