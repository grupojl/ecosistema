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
import { createTrpcAuthMiddleware } from '@real/auth-server';

import { createAppRouter }          from './app-router';
import { createTrpcContext }        from './trpc';

import { UsersService }             from '../users/users.service';
import { AuthService }              from '../auth/auth.service';
import { OrganizationsService }     from '../organizations/organizations.service';
import { CollaboratorsService }     from '../collaborators/collaborators.service';
import { ConfigFlagsService }       from '../config-flags/config-flags.service';
import { ConfigQuotasService }      from '../config-quotas/config-quotas.service';
import { ConfigThemesService }      from '../config-themes/config-themes.service';
import { ConfigWebhooksService }    from '../config-webhooks/config-webhooks.service';
import { ConfigAuditService }       from '../config-audit/config-audit.service';
import { ConfigSecretsService }     from '../config-secrets/config-secrets.service';

import { UsersModule }              from '../users/users.module';
import { AuthModule }               from '../auth/auth.module';
import { OrganizationsModule }      from '../organizations/organizations.module';
import { CollaboratorsModule }      from '../collaborators/collaborators.module';
import { ConfigFlagsModule }        from '../config-flags/config-flags.module';
import { ConfigQuotasModule }       from '../config-quotas/config-quotas.module';
import { ConfigThemesModule }       from '../config-themes/config-themes.module';
import { ConfigWebhooksModule }     from '../config-webhooks/config-webhooks.module';
import { ConfigAuditModule }        from '../config-audit/config-audit.module';
import { ConfigSecretsModule }      from '../config-secrets/config-secrets.module';

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
  ],
  providers: [TrpcService],
})
export class TrpcModule implements NestModule {
  constructor(private readonly trpcService: TrpcService) {}

  configure(consumer: MiddlewareConsumer): void {
    const { firebaseAuth, tenantContext } = this.trpcService.authMiddleware;

    consumer
      .apply(firebaseAuth, tenantContext, this.trpcService.handler)
      .forRoutes('/api/v1/trpc');
  }
}
