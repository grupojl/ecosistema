import { router }                          from './trpc';
import { createAuthRouter }                from './routers/auth.router';
import { createOrganizationsRouter }       from './routers/organizations.router';
import { createCollaboratorsRouter }       from './routers/collaborators.router';
import { createConfigFlagsRouter }         from './routers/config-flags.router';
import { createConfigQuotasRouter }        from './routers/config-quotas.router';
import { createConfigThemesRouter }        from './routers/config-themes.router';
import { createConfigWebhooksRouter }      from './routers/config-webhooks.router';
import { createConfigAuditRouter }         from './routers/config-audit.router';
import { createConfigSecretsRouter }       from './routers/config-secrets.router';
import { createConfigTemplatesRouter }     from './routers/config-templates.router';
import { createAffiliatesRouter }          from './routers/affiliates.router';

import type { UsersService }               from '../users/users.service';
import type { AuthService }                from '../auth/auth.service';
import type { OrganizationsService }       from '../organizations/organizations.service';
import type { CollaboratorsService }       from '../collaborators/collaborators.service';
import type { ConfigFlagsService }         from '../config-flags/config-flags.service';
import type { ConfigQuotasService }        from '../config-quotas/config-quotas.service';
import type { ConfigThemesService }        from '../config-themes/config-themes.service';
import type { ConfigWebhooksService }      from '../config-webhooks/config-webhooks.service';
import type { ConfigAuditService }         from '../config-audit/config-audit.service';
import type { ConfigSecretsService }       from '../config-secrets/config-secrets.service';
import type { ConfigTemplatesService }     from '../config-templates/config-templates.service';
import type { AffiliatesService }          from '../affiliate/affiliate.service';

export interface AppRouterDeps {
  usersService:       UsersService;
  authService:        AuthService;
  orgsService:        OrganizationsService;
  collaboratorsService: CollaboratorsService;
  flagsService:       ConfigFlagsService;
  quotasService:      ConfigQuotasService;
  themesService:      ConfigThemesService;
  webhooksService:    ConfigWebhooksService;
  auditService:       ConfigAuditService;
  secretsService:     ConfigSecretsService;
  templatesService:   ConfigTemplatesService;
  affiliatesService:  AffiliatesService;
}

export function createAppRouter(deps: AppRouterDeps) {
  return router({
    auth:            createAuthRouter(deps.usersService, deps.authService),
    organizations:   createOrganizationsRouter(deps.orgsService),
    collaborators:   createCollaboratorsRouter(deps.collaboratorsService),
    configFlags:     createConfigFlagsRouter(deps.flagsService),
    configQuotas:    createConfigQuotasRouter(deps.quotasService),
    configThemes:    createConfigThemesRouter(deps.themesService),
    configWebhooks:  createConfigWebhooksRouter(deps.webhooksService),
    configAudit:     createConfigAuditRouter(deps.auditService),
    configSecrets:   createConfigSecretsRouter(deps.secretsService),
    configTemplates: createConfigTemplatesRouter(deps.templatesService),
    affiliates:      createAffiliatesRouter(deps.affiliatesService),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
