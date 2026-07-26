import { Module }                  from '@nestjs/common';
import { ConfigModule }            from '@nestjs/config';
import { APP_GUARD }               from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule }      from '@nestjs/event-emitter';
import { BullModule }              from '@nestjs/bullmq';

import { HealthModule }           from './health/health.module';
import { PrismaModule }           from './prisma/prisma.module';
import { RedisModule }            from './redis/redis.module';
import { AuthModule }             from './auth/auth.module';
import { UsersModule }            from './users/users.module';
import { OrganizationsModule }    from './organizations/organizations.module';
import { AffiliatesModule }       from './affiliate/affiliate.module';
import { CollaboratorsModule }    from './collaborators/collaborators.module';
import { ConfigCacheModule }      from './config-cache/config-cache.module';
import { ConfigAuditModule }      from './config-audit/config-audit.module';
import { ConfigThemesModule }     from './config-themes/config-themes.module';
import { ConfigFlagsModule }      from './config-flags/config-flags.module';
import { ConfigSecretsModule }    from './config-secrets/config-secrets.module';
import { ConfigTemplatesModule }  from './config-templates/config-templates.module';
import { ConfigQuotasModule }     from './config-quotas/config-quotas.module';
import { ConfigWebhooksModule }   from './config-webhooks/config-webhooks.module';
import { FirebaseAuthGuard }      from './common/guards/firebase-auth.guard';
import { TrpcModule }             from './trpc/trpc.module';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';

@Module({
  imports: [
    HealthModule,
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 30 }]),
    EventEmitterModule.forRoot({ wildcard: false }),
    ...(REDIS_ENABLED ? [
      BullModule.forRoot({
        connection: { url: process.env['REDIS_URL'] ?? 'redis://localhost:6379' },
      }),
    ] : []),
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
    TrpcModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
