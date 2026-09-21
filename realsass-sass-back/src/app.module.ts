import { LoggerModule }    from 'nestjs-pino';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { Module, type NestModule, type MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';                     from '@nestjs/common';
import { ConfigModule }               from '@nestjs/config';
import { APP_GUARD }                  from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule }         from '@nestjs/event-emitter';

import { HealthModule }          from './health/health.module';
import { PrismaModule }          from './prisma/prisma.module';
import { RedisModule }           from './redis/redis.module';
import { AuthModule }            from './auth/auth.module';
import { UsersModule }           from './users/users.module';
import { OrganizationsModule }   from './organizations/organizations.module';
import { AffiliatesModule }      from './affiliate/affiliate.module';
import { CollaboratorsModule }   from './collaborators/collaborators.module';
import { ConfigCacheModule }     from './config-cache/config-cache.module';
import { ConfigAuditModule }     from './config-audit/config-audit.module';
import { ConfigThemesModule }    from './config-themes/config-themes.module';
import { ConfigFlagsModule }     from './config-flags/config-flags.module';
import { ConfigSecretsModule }   from './config-secrets/config-secrets.module';
import { ConfigTemplatesModule } from './config-templates/config-templates.module';
import { ConfigQuotasModule }    from './config-quotas/config-quotas.module';
import { ConfigWebhooksModule }  from './config-webhooks/config-webhooks.module';
import { InternalModule }    from './internal/internal.module';
import { MarketsModule }     from './markets/markets.module';
import { TrpcModule }            from './trpc/trpc.module';

import {
  FirebaseModule,
  FirebaseAuthGuard,
  RolesGuard,
  CACHE_PORT,
  MemoryCacheAdapter,
} from '@real/auth-server';

// sass-back NO usa TenantGuard — el TenantContext se resuelve directamente
// desde Prisma en cada service (sin hop de red).

@Module({
  imports: [
    PrometheusModule.register({ path: '/metrics', defaultMetrics: { enabled: true } }),
    LoggerModule.forRoot({ pinoHttp: { level: process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] !== 'production' ? 'debug' : 'info'), transport: process.env['NODE_ENV'] !== 'production' ? { target: 'pino-pretty', options: { colorize: true } } : undefined } }),
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 30 }]),
    EventEmitterModule.forRoot({ wildcard: false }),
    FirebaseModule,
    HealthModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    AffiliatesModule,
    CollaboratorsModule,
    ConfigCacheModule,
    ConfigAuditModule,
    ConfigThemesModule,
    ConfigFlagsModule,
    ConfigSecretsModule,
    ConfigTemplatesModule,
    ConfigQuotasModule,
    ConfigWebhooksModule,
    InternalModule,
    MarketsModule,
    TrpcModule,
  ],
  providers: [
    { provide: APP_GUARD,  useClass: FirebaseAuthGuard },
    { provide: APP_GUARD,  useClass: RolesGuard },
    { provide: APP_GUARD,  useClass: ThrottlerGuard },
    { provide: CACHE_PORT, useClass: MemoryCacheAdapter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
