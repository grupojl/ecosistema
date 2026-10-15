import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { parseAllowedOrigins, requireEnv, trustProxyHops } from '@real/auth-server';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';

async function bootstrap(): Promise<void> {
  // ── Falla cerrado: sin su configuración de seguridad el servicio NO levanta ──
  // (antes arrancaba "abierto": sin ALLOWED_ORIGINS reflejaba cualquier Origin con credenciales).
  const allowedOrigins = parseAllowedOrigins();
  // Misma clave que sass-back; admite varias separadas por coma ("nueva,vieja") para rotar sin caída.
  requireEnv('INTERNAL_API_KEY', { minLength: process.env['NODE_ENV'] === 'production' ? 32 : 1 });
  // Secreto con el que se firma la sesión del cliente del storefront (ver CustomerSessionService).
  requireEnv('CUSTOMER_SESSION_SECRET', { minLength: 32 });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // Detrás de Railway el cliente real llega en X-Forwarded-For: sin esto el rate limit ve una sola IP.
  app.set('trust proxy', trustProxyHops());

  app.setGlobalPrefix('api/v1');
  // ADR-004: la sesión del dashboard llega en la cookie HttpOnly __session; sin esto req.cookies queda vacío.
  app.use(cookieParser());

  // ── Seguridad: Helmet ─────────────────────────────────────────────────────
  // Es una API: no sirve HTML, así que la CSP es la más estricta posible.
  // crossOriginResourcePolicy: cross-origin permite que el storefront (origen distinto) consuma la API.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc:     ["'none'"],
          frameAncestors: ["'none'"],
          baseUri:        ["'none'"],
          formAction:     ["'none'"],
        },
      },
    }),
  );

  // ── Seguridad: CORS ───────────────────────────────────────────────────────
  // Lista explícita de orígenes (ALLOWED_ORIGINS). Un storefront con dominio propio se agrega acá.
  // La sesión del cliente viaja en la cookie HttpOnly store_session y la del dashboard en __session (ADR-004).
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id', 'x-visitor-country', 'x-trpc-source'],
    credentials: true,
  });

  // Validación: Zod (input() de tRPC). No hay un ValidationPipe global: ningún DTO usa class-validator (ADR-024).
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = parseInt(process.env['PORT'] ?? '3025', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`🛍️  real-ecommerce-back en http://0.0.0.0:${port}/api/v1`);
  logger.log(`🔥 Firebase Auth SSO activo (rutas @Public() lo saltan)`);
  logger.log(`🛡️  Helmet + CORS cerrado + rate limit en REST (30/min) y en /trpc activos`);
}

void bootstrap();
