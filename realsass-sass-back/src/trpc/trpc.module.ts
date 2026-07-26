/**
 * src/trpc/trpc.module.ts
 *
 * Monta el adapter tRPC como middleware Express en /api/v1/trpc.
 *
 * Por qué middleware y no Controller:
 *   El adapter de tRPC es Express puro. NestJS no sabe leer su batching.
 *   Lo montamos antes del pipeline de NestJS en ese path específico.
 *
 * Auth flow:
 *   El FirebaseAuthGuard global (APP_GUARD) NO corre sobre middleware Express.
 *   TrpcService.applyFirebaseAuth() replica la verificación antes del adapter.
 *
 * TenantGuard:
 *   El TenantGuard necesita Prisma para resolver rol. Lo inyectamos en
 *   applyTenantContext() para que tenantProcedure y ownerProcedure funcionen.
 */
import {
  Module,
  Injectable,
  type NestModule,
  type MiddlewareConsumer,
} from '@nestjs/common';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import type { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

import { createAppRouter }           from './app-router';
import { createTrpcContext }         from './trpc';
import { PrismaService }             from '../prisma/prisma.service';

import { UsersService }              from '../users/users.service';
import { AuthService }               from '../auth/auth.service';
import { OrganizationsService }      from '../organizations/organizations.service';
import { CollaboratorsService }      from '../collaborators/collaborators.service';
import { ConfigFlagsService }        from '../config-flags/config-flags.service';
import { ConfigQuotasService }       from '../config-quotas/config-quotas.service';
import { ConfigThemesService }       from '../config-themes/config-themes.service';
import { ConfigWebhooksService }     from '../config-webhooks/config-webhooks.service';
import { ConfigAuditService }        from '../config-audit/config-audit.service';
import { ConfigSecretsService }      from '../config-secrets/config-secrets.service';

import { UsersModule }               from '../users/users.module';
import { AuthModule }                from '../auth/auth.module';
import { OrganizationsModule }       from '../organizations/organizations.module';
import { CollaboratorsModule }       from '../collaborators/collaborators.module';
import { ConfigFlagsModule }         from '../config-flags/config-flags.module';
import { ConfigQuotasModule }        from '../config-quotas/config-quotas.module';
import { ConfigThemesModule }        from '../config-themes/config-themes.module';
import { ConfigWebhooksModule }      from '../config-webhooks/config-webhooks.module';
import { ConfigAuditModule }         from '../config-audit/config-audit.module';
import { ConfigSecretsModule }       from '../config-secrets/config-secrets.module';

const FULL_PERMISSIONS = {
  canViewListings: true, canCreateListings: true, canEditListings: true,
  canDeleteListings: true, canViewStats: true, canManageLeads: true,
  canManageCollaborators: true,
};

@Injectable()
export class TrpcService {
  public readonly trpcMiddleware: ReturnType<typeof createExpressMiddleware>;

  constructor(
    private readonly prisma:        PrismaService,
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
  ) {
    const appRouter = createAppRouter({
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

    this.trpcMiddleware = createExpressMiddleware({
      router:        appRouter,
      createContext: createTrpcContext,
      onError: ({ path, error }) => {
        console.error(`[tRPC] ${path ?? 'unknown'}: ${error.message}`);
      },
    });
  }

  /**
   * Verifica el token Firebase e inyecta req.user.
   * Replica lo que hace FirebaseAuthGuard sin el pipeline de NestJS.
   */
  async applyFirebaseAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const decoded = await admin.app().auth().verifyIdToken(token);
        (req as any).user = {
          uid:           decoded.uid,
          email:         decoded.email       ?? '',
          emailVerified: decoded.email_verified ?? false,
        };
      } catch {
        // Token inválido — enforceAuth rechazará con UNAUTHORIZED
      }
    }
    next();
  }

  /**
   * Resuelve TenantContext desde Prisma e inyecta req.tenant.
   * Necesario para tenantProcedure y ownerProcedure.
   */
  async applyTenantContext(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const user           = (req as any).user as { uid: string } | undefined;
    const organizationId = req.headers['x-organization-id'] as string | undefined;

    if (user?.uid && organizationId) {
      try {
        const dbUser = await this.prisma.user.findUnique({
          where:   { firebaseUid: user.uid },
          include: {
            organization:   { select: { id: true } },
            collaborations: {
              where:  { organizationId, status: 'ACTIVE' },
              select: { id: true, permissions: true },
            },
          },
        });

        if (dbUser) {
          if (dbUser.isOwner && dbUser.organization?.id === organizationId) {
            (req as any).tenant = {
              userId: dbUser.id,
              organizationId,
              role:        'OWNER',
              permissions: FULL_PERMISSIONS,
            };
          } else if (dbUser.collaborations[0]) {
            const collab = dbUser.collaborations[0];
            (req as any).tenant = {
              userId: dbUser.id,
              organizationId,
              role:        'COLLABORATOR',
              permissions: (collab.permissions as any) ?? {},
            };
          }
        }
      } catch {
        // Sin tenant — los procedures que lo requieran rechazarán con FORBIDDEN
      }
    }
    next();
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
  exports:   [TrpcService],
})
export class TrpcModule implements NestModule {
  constructor(private readonly trpcService: TrpcService) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        this.trpcService.applyFirebaseAuth.bind(this.trpcService),
        this.trpcService.applyTenantContext.bind(this.trpcService),
        this.trpcService.trpcMiddleware,
      )
      .forRoutes('/api/v1/trpc');
  }
}
