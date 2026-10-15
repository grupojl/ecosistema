import { NestFactory }      from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet               from 'helmet';
import cookieParser         from 'cookie-parser';
import { AppModule }        from '@/app.module';
import {
  ZodExceptionFilter, parseAllowedOrigins, requireEnv, trustProxyHops,
} from '@real/auth-server';

async function bootstrap() {
  // ── Falla cerrado: sin su configuración de seguridad el servicio NO levanta ──
  // INTERNAL_API_KEY admite varias claves separadas por coma ("nueva,vieja") para rotar sin caída.
  requireEnv('INTERNAL_API_KEY', { minLength: process.env.NODE_ENV === 'production' ? 32 : 1 });
  // ALLOWED_ORIGINS: lista explícita. credentials: true con origin '*' es una vulnerabilidad CORS activa.
  const allowedOrigins = parseAllowedOrigins();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Detrás de Railway el cliente real llega en X-Forwarded-For: sin esto el rate limit ve una sola IP.
  app.set('trust proxy', trustProxyHops());

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
  // Esto es una API: no sirve HTML, así que la CSP es la más estricta posible. La UI de bull-board
  // (/admin/queues, protegida con API key) sí necesita scripts propios y usa los defaults de helmet.
  const apiHelmet = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc:     ["'none'"],
        frameAncestors: ["'none'"],
        baseUri:        ["'none'"],
        formAction:     ["'none'"],
      },
    },
  });
  const uiHelmet = helmet();
  app.use((req: Request, res: Response, next: NextFunction) =>
    (req.path.includes('/admin/queues') ? uiHelmet : apiHelmet)(req, res, next));

  // Validación: Zod (ZodValidationPipe en cada @Body/@Query que lo necesita, input() en tRPC). No hay un
  // ValidationPipe global: ningún DTO usa class-validator (ADR-024).

  const port = process.env.PORT ?? 3020;
  app.useGlobalFilters(new ZodExceptionFilter());
  await app.listen(port);
}

void bootstrap();
