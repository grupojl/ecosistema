import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api/v1');
  // ADR-004: la sesión del dashboard llega en la cookie HttpOnly __session; sin esto req.cookies queda vacío.
  app.use(cookieParser());

  // ── Seguridad: Helmet ─────────────────────────────────────────────────────
  // crossOriginResourcePolicy: cross-origin permite que el storefront (origen
  // distinto) cargue recursos sin bloqueo adicional de CORP.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // ── Seguridad: CORS ───────────────────────────────────────────────────────
  // ecommerce-back sirve al storefront público — si no hay origenes explícitos
  // se refleja el Origin del request (origin: true). Distinto a real-back donde
  // el wildcard + credentials es inaceptable porque maneja tokens de identidad.
  const rawOrigins = process.env['ALLOWED_ORIGINS'] ?? '';
  const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-organization-id',
      'x-customer-id',
      'x-visitor-country',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = parseInt(process.env['PORT'] ?? '3025', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`🛍️  real-ecommerce-back en http://0.0.0.0:${port}/api/v1`);
  logger.log(`🔥 Firebase Auth SSO activo (rutas @Public() lo saltan)`);
  logger.log(`🛡️  Helmet + ThrottlerGuard (30 req/min) activos`);
}

bootstrap();
