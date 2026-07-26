/**
 * src/trpc/app-router.ts
 *
 * Router raíz de real-back.
 * Exporta AppRouter como tipo para packages/trpc-contract.
 *
 * Namespaces:
 *   auth.*            → autenticación y perfil
 *   organizations.*   → org del owner
 *   collaborators.*   → gestión de colaboradores
 *   configFlags.*     → feature flags
 *   configQuotas.*    → quotas y límites
 *   configThemes.*    → temas visuales
 *   configWebhooks.*  → endpoints webhook
 *   configAudit.*     → log de cambios de config
 *   configSecrets.*   → secretos cifrados
 */
import { router }                         from './trpc';
import { createAuthRouter }               from './routers/auth.router';
import { createOrganizationsRouter }      from './routers/organizations.router';
import { createCollaboratorsRouter }      from './routers/collaborators.router';
import { createConfigFlagsRouter }        from './routers/config-flags.router';
import { createConfigQuotasRouter }       from './routers/config-quotas.router';
import { createConfigThemesRouter }       from './routers/config-themes.router';
import { createConfigWebhooksRouter }     from './routers/config-webhooks.router';
import { createConfigAuditRouter }        from './routers/config-audit.router';
import { createConfigSecretsRouter }      from './routers/config-secrets.router';

import type { UsersService }              from '../users/users.service';
import type { AuthService }               from '../auth/auth.service';
import type { OrganizationsService }      from '../organizations/organizations.service';
import type { CollaboratorsService }      from '../collaborators/collaborators.service';
import type { ConfigFlagsService }        from '../config-flags/config-flags.service';
import type { ConfigQuotasService }       from '../config-quotas/config-quotas.service';
import type { ConfigThemesService }       from '../config-themes/config-themes.service';
import type { ConfigWebhooksService }     from '../config-webhooks/config-webhooks.service';
import type { ConfigAuditService }        from '../config-audit/config-audit.service';
import type { ConfigSecretsService }      from '../config-secrets/config-secrets.service';

export interface AppRouterDeps {
  usersService:        UsersService;
  authService:         AuthService;
  orgsService:         OrganizationsService;
  collaboratorsService: CollaboratorsService;
  flagsService:        ConfigFlagsService;
  quotasService:       ConfigQuotasService;
  themesService:       ConfigThemesService;
  webhooksService:     ConfigWebhooksService;
  auditService:        ConfigAuditService;
  secretsService:      ConfigSecretsService;
}

export function createAppRouter(deps: AppRouterDeps) {
  return router({
    auth:           createAuthRouter(deps.usersService, deps.authService),
    organizations:  createOrganizationsRouter(deps.orgsService),
    collaborators:  createCollaboratorsRouter(deps.collaboratorsService),
    configFlags:    createConfigFlagsRouter(deps.flagsService),
    configQuotas:   createConfigQuotasRouter(deps.quotasService),
    configThemes:   createConfigThemesRouter(deps.themesService),
    configWebhooks: createConfigWebhooksRouter(deps.webhooksService),
    configAudit:    createConfigAuditRouter(deps.auditService),
    configSecrets:  createConfigSecretsRouter(deps.secretsService),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
