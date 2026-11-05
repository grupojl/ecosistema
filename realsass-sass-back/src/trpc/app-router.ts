import { router } from '@/trpc/trpc';
import { createAuthRouter } from '@/trpc/routers/auth.router';
import { createOrganizationsRouter } from '@/trpc/routers/organizations.router';
import { createCollaboratorsRouter } from '@/trpc/routers/collaborators.router';
import { createConfigFlagsRouter } from '@/trpc/routers/config-flags.router';
import { createConfigQuotasRouter } from '@/trpc/routers/config-quotas.router';
import { createConfigThemesRouter } from '@/trpc/routers/config-themes.router';
import { createConfigWebhooksRouter } from '@/trpc/routers/config-webhooks.router';
import { createConfigAuditRouter } from '@/trpc/routers/config-audit.router';
import { createConfigSecretsRouter } from '@/trpc/routers/config-secrets.router';
import { createConfigTemplatesRouter } from '@/trpc/routers/config-templates.router';
import { createAffiliatesRouter } from '@/trpc/routers/affiliates.router';
import { createMarketsRouter } from '@/trpc/routers/markets.router';
import { createSessionsRouter } from '@/trpc/routers/sessions.router';
import type { SessionsService } from '@/sessions/sessions.service';
import type { DesktopLoginService } from '@/auth/desktop-login.service';
import { createDesktopRouter } from '@/trpc/routers/desktop.router';
import type { DesktopService } from '@/desktop/desktop.service';
import { createWhatsappRouter } from '@/trpc/routers/whatsapp.router';
import type { WhatsappService } from '@/whatsapp/whatsapp.service';
import { createFeedbackRouter } from '@/trpc/routers/feedback.router';
import { createOrgSettingsRouter } from '@/trpc/routers/org-settings.router';
import type { OrgSettingsService } from '@/org-settings/org-settings.service';
import type { FeedbackService } from '@/feedback/feedback.service';
import {
  createMunicipalityRouter,
  createSubscriptionRouter,
} from '@/trpc/routers/municipality.router';
import {
  createOrgChartRouter,
  createEntityPermissionsRouter,
} from '@/trpc/routers/org-chart.router';
import {
  createKnowledgeRouter,
  createMandatesRouter,
} from '@/trpc/routers/knowledge.router';
import { createChannelsRouter } from '@/trpc/routers/channels.router';
import {
  createQualityRouter,
  createGapsRouter,
} from '@/trpc/routers/quality.router';
import {
  createProfilesRouter,
  createKeysRouter,
} from '@/trpc/routers/api-access.router';
import type { MunicipalityService } from '@/welver/municipality/municipality.service';
import type { SubscriptionService } from '@/welver/subscription/subscription.service';
import type { EntityPermissionsService } from '@/welver/entity-access/entity-access.service';
import type { OrgChartService } from '@/welver/org-chart/org-chart.service';
import type { KnowledgeService } from '@/welver/knowledge/knowledge.service';
import type { MandatesService } from '@/welver/mandates/mandates.service';
import type { ChannelsService } from '@/welver/channels/channels.service';
import type { QualityService } from '@/welver/quality/quality.service';
import type { GapsService } from '@/welver/gaps/gaps.service';
import type { ApiAccessService } from '@/welver/api-access/api-access.service';

import type { UsersService } from '@/users/users.service';
import type { AuthService } from '@/auth/auth.service';
import type { OrganizationsService } from '@/organizations/organizations.service';
import type { CollaboratorsService } from '@/collaborators/collaborators.service';
import type { ConfigFlagsService } from '@/config-flags/config-flags.service';
import type { ConfigQuotasService } from '@/config-quotas/config-quotas.service';
import type { ConfigThemesService } from '@/config-themes/config-themes.service';
import type { ConfigWebhooksService } from '@/config-webhooks/config-webhooks.service';
import type { ConfigAuditService } from '@/config-audit/config-audit.service';
import type { ConfigSecretsService } from '@/config-secrets/config-secrets.service';
import type { ConfigTemplatesService } from '@/config-templates/config-templates.service';
import type { AffiliatesService } from '@/affiliate/affiliate.service';
import type { MarketsService } from '@/markets/markets.service';

export interface AppRouterDeps {
  usersService: UsersService;
  authService: AuthService;
  desktopLoginService: DesktopLoginService;
  orgsService: OrganizationsService;
  collaboratorsService: CollaboratorsService;
  flagsService: ConfigFlagsService;
  quotasService: ConfigQuotasService;
  themesService: ConfigThemesService;
  webhooksService: ConfigWebhooksService;
  auditService: ConfigAuditService;
  secretsService: ConfigSecretsService;
  templatesService: ConfigTemplatesService;
  affiliatesService: AffiliatesService;
  marketsService: MarketsService;
  sessionsService: SessionsService;
  whatsappService: WhatsappService;
  feedbackService: FeedbackService;
  settingsService: OrgSettingsService;
  desktopService: DesktopService;
  // Welver
  municipalityService: MunicipalityService;
  subscriptionService: SubscriptionService;
  entityPermissionsService: EntityPermissionsService;
  orgChartService: OrgChartService;
  knowledgeService: KnowledgeService;
  mandatesService: MandatesService;
  channelsService: ChannelsService;
  qualityService: QualityService;
  gapsService: GapsService;
  apiAccessService: ApiAccessService;
}

export function createAppRouter(deps: AppRouterDeps) {
  return router({
    auth: createAuthRouter(
      deps.usersService,
      deps.authService,
      deps.desktopLoginService,
    ),
    organizations: createOrganizationsRouter(deps.orgsService),
    collaborators: createCollaboratorsRouter(deps.collaboratorsService),
    configFlags: createConfigFlagsRouter(deps.flagsService),
    configQuotas: createConfigQuotasRouter(deps.quotasService),
    configThemes: createConfigThemesRouter(
      deps.themesService,
      deps.orgsService,
    ),
    configWebhooks: createConfigWebhooksRouter(deps.webhooksService),
    configAudit: createConfigAuditRouter(deps.auditService),
    configSecrets: createConfigSecretsRouter(deps.secretsService),
    configTemplates: createConfigTemplatesRouter(deps.templatesService),
    affiliates: createAffiliatesRouter(deps.affiliatesService),
    markets: createMarketsRouter(deps.marketsService),
    sessions: createSessionsRouter(deps.sessionsService),
    whatsapp: createWhatsappRouter(deps.whatsappService),
    feedback: createFeedbackRouter(deps.feedbackService),
    settings: createOrgSettingsRouter(deps.settingsService, deps.orgsService),
    desktop: createDesktopRouter(deps.desktopService),
    // Welver — ver .claude/domain/welver-domain.md §15.3
    municipio: createMunicipalityRouter(deps.municipalityService),
    suscripcion: createSubscriptionRouter(deps.subscriptionService),
    organigrama: createOrgChartRouter(deps.orgChartService),
    permisosEnte: createEntityPermissionsRouter(deps.entityPermissionsService),
    conocimiento: createKnowledgeRouter(deps.knowledgeService),
    mandatos: createMandatesRouter(deps.mandatesService),
    canales: createChannelsRouter(deps.channelsService),
    calidad: createQualityRouter(deps.qualityService),
    huecos: createGapsRouter(deps.gapsService),
    perfiles: createProfilesRouter(deps.apiAccessService),
    claves: createKeysRouter(deps.apiAccessService),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
