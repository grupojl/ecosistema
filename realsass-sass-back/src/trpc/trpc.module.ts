/**
 * src/trpc/trpc.module.ts — realsass-sass-back
 *
 * Auth flow (centralizado en @real/auth-server — Capa 1):
 *   1. firebaseAuth     → verifica Bearer token → inyecta req.user + req.firebaseToken
 *   2. tenantContext    → lee x-organization-id → inyecta req.tenant
 *   3. trpcHandler      → adapter tRPC con context ya resuelto
 */
import {
  Module,
  Injectable,
  type NestModule,
  type MiddlewareConsumer,
} from '@nestjs/common';
import { createExpressMiddleware }  from '@trpc/server/adapters/express';
import { createRateLimitMiddleware, createTrpcAuthMiddleware, RedisRateLimitStore } from '@real/auth-server';
import { RedisService } from '@/redis/redis.service';

import { createAppRouter }          from '@/trpc/app-router';
import { createTrpcContext }        from '@/trpc/trpc';
import { IP_RATE_LIMIT, USER_RATE_LIMIT } from '@/trpc/rate-limit.config';

import { UsersService }             from '@/users/users.service';
import { AuthService }              from '@/auth/auth.service';
import { OrganizationsService }     from '@/organizations/organizations.service';
import { CollaboratorsService }     from '@/collaborators/collaborators.service';
import { ConfigFlagsService }       from '@/config-flags/config-flags.service';
import { ConfigQuotasService }      from '@/config-quotas/config-quotas.service';
import { ConfigThemesService }      from '@/config-themes/config-themes.service';
import { ConfigWebhooksService }    from '@/config-webhooks/config-webhooks.service';
import { ConfigAuditService }       from '@/config-audit/config-audit.service';
import { ConfigTemplatesService }    from '@/config-templates/config-templates.service';
import { AffiliatesService }          from '@/affiliate/affiliate.service';
import { ConfigTemplatesModule }      from '@/config-templates/config-templates.module';
import { AffiliatesModule }            from '@/affiliate/affiliate.module';
import { ConfigSecretsService }     from '@/config-secrets/config-secrets.service';

import { UsersModule }              from '@/users/users.module';
import { AuthModule }               from '@/auth/auth.module';
import { OrganizationsModule }      from '@/organizations/organizations.module';
import { CollaboratorsModule }      from '@/collaborators/collaborators.module';
import { ConfigFlagsModule }        from '@/config-flags/config-flags.module';
import { ConfigQuotasModule }       from '@/config-quotas/config-quotas.module';
import { ConfigThemesModule }       from '@/config-themes/config-themes.module';
import { ConfigWebhooksModule }     from '@/config-webhooks/config-webhooks.module';
import { ConfigAuditModule }        from '@/config-audit/config-audit.module';
import { ConfigSecretsModule }      from '@/config-secrets/config-secrets.module';
import { MarketsService }             from '@/markets/markets.service';
import { MarketsModule }               from '@/markets/markets.module';

@Injectable()
export class TrpcService {
  constructor(
    private readonly users:         UsersService,
    private readonly auth:          AuthService,
    private readonly orgs:          OrganizationsService,
    private readonly collaborators: CollaboratorsService,
    private readonly flags:         ConfigFlagsService,
    private readonly quotas:        ConfigQuotasService,
    private readonly themes:        ConfigThemesService,
    private readonly webhooks:      ConfigWebhooksService,
    private readonly audit:         ConfigAuditService,
    private readonly secrets:       ConfigSecretsService,
    private readonly templates:     ConfigTemplatesService,
    private readonly affiliates:    AffiliatesService,
    private readonly markets:       MarketsService,
  ) {}

  get handler() {
    const router = createAppRouter({
      usersService:         this.users,
      authService:          this.auth,
      orgsService:          this.orgs,
      collaboratorsService: this.collaborators,
      flagsService:         this.flags,
      quotasService:        this.quotas,
      themesService:        this.themes,
      webhooksService:      this.webhooks,
      auditService:         this.audit,
      secretsService:       this.secrets,
      marketsService:     this.markets,
      templatesService:   this.templates,
      affiliatesService:  this.affiliates,
    });

    return createExpressMiddleware({
      router,
      createContext: createTrpcContext,
    });
  }

  get authMiddleware() {
    return createTrpcAuthMiddleware({
      // sass-back resuelve desde Prisma — el token no se necesita.
      getOrganizationAccess: (_token, uid, orgId) =>
        this.users.getOrganizationAccess(uid, orgId),
    });
  }
}

@Module({
  imports: [
    UsersModule,
    AuthModule,
    OrganizationsModule,
    CollaboratorsModule,
    ConfigFlagsModule,
    ConfigQuotasModule,
    ConfigThemesModule,
    ConfigWebhooksModule,
    ConfigAuditModule,
    ConfigSecretsModule,
    ConfigTemplatesModule,
    AffiliatesModule,
    MarketsModule,
  ],
  providers: [TrpcService],
})
export class TrpcModule implements NestModule {
  constructor(
    private readonly trpcService: TrpcService,
    private readonly redis: RedisService,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    const { firebaseAuth, tenantContext } = this.trpcService.authMiddleware;

    // ThrottlerGuard solo cubre controllers: /trpc es middleware de Express y estaba sin límite.
    // 1) por IP, ANTES de verificar el token  2) por usuario, DESPUÉS de autenticar
    // Contador en Redis (compartido entre réplicas); sin Redis cae a memoria por instancia.
    const store     = new RedisRateLimitStore(this.redis);
    const ipLimit   = createRateLimitMiddleware({ ...IP_RATE_LIMIT, store });
    const userLimit = createRateLimitMiddleware({ ...USER_RATE_LIMIT, store });

    consumer
      .apply(ipLimit, firebaseAuth, tenantContext, userLimit, this.trpcService.handler)
      .forRoutes('/api/v1/trpc');
  }
}
