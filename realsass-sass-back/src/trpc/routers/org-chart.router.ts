/**
 * org-chart.router.ts — `organigrama.*` y `permisosEnte.*` (welver-domain.md §15.3).
 *
 * La autorización fina (qué ente puede tocar quien llama) la resuelve el servicio con los permisos por ente; el router
 * solo exige sesión y organización. La estructura sensible (archivar, restaurar, plantillas) y los permisos son del dueño.
 */
import { z } from 'zod';
import { router, tenantProcedure, ownerProcedure } from '@/trpc/trpc';
import type { OrgChartService } from '@/welver/org-chart/org-chart.service';
import type { EntityPermissionsService } from '@/welver/entity-access/entity-access.service';
import {
  ORG_CHART_TEMPLATES,
  TEMPLATE_KEYS,
  flattenTemplate,
} from '@/welver/domain/org-chart-templates';
import { actorOf } from '@/trpc/routers/welver-actor';
import {
  ApplyTemplateSchema,
  CreateEntitySchema,
  IdSchema,
  LinkEntitiesSchema,
  ListEntitiesSchema,
  RemovePermissionSchema,
  SetPermissionSchema,
  UpdateEntitySchema,
} from '@/welver/welver.schemas';

export function createOrgChartRouter(orgChart: OrgChartService) {
  return router({
    list: tenantProcedure
      .input(ListEntitiesSchema.optional())
      .query(({ ctx, input }) =>
        orgChart.list(actorOf(ctx), {
          includeArchived: input?.includeArchived ?? false,
        }),
      ),

    get: tenantProcedure
      .input(z.object({ id: IdSchema }))
      .query(({ ctx, input }) => orgChart.get(actorOf(ctx), input.id)),

    create: tenantProcedure
      .input(CreateEntitySchema)
      .mutation(({ ctx, input }) => orgChart.create(actorOf(ctx), input)),

    update: tenantProcedure
      .input(UpdateEntitySchema)
      .mutation(({ ctx, input }) => {
        const { id, ...patch } = input;
        return orgChart.update(actorOf(ctx), id, patch);
      }),

    archive: ownerProcedure
      .input(z.object({ id: IdSchema }))
      .mutation(({ ctx, input }) => orgChart.archive(actorOf(ctx), input.id)),

    restore: ownerProcedure
      .input(z.object({ id: IdSchema }))
      .mutation(({ ctx, input }) => orgChart.restore(actorOf(ctx), input.id)),

    listLinks: tenantProcedure.query(({ ctx }) =>
      orgChart.listLinks(actorOf(ctx)),
    ),

    link: tenantProcedure
      .input(LinkEntitiesSchema)
      .mutation(({ ctx, input }) =>
        orgChart.link(
          actorOf(ctx),
          input.fromEntityId,
          input.toEntityId,
          input.label,
        ),
      ),

    unlink: tenantProcedure
      .input(z.object({ id: IdSchema }))
      .mutation(({ ctx, input }) => orgChart.unlink(actorOf(ctx), input.id)),

    /** Plantillas disponibles (estructura sin datos). */
    templates: tenantProcedure.query(() =>
      TEMPLATE_KEYS.map((key) => {
        const t = ORG_CHART_TEMPLATES[key];
        return {
          key,
          label: t.label,
          description: t.description,
          entities: flattenTemplate(t).length,
        };
      }),
    ),

    applyTemplate: ownerProcedure
      .input(ApplyTemplateSchema)
      .mutation(({ ctx, input }) =>
        orgChart.applyTemplate(actorOf(ctx), input.template),
      ),
  });
}

export function createEntityPermissionsRouter(
  permissions: EntityPermissionsService,
) {
  return router({
    list: ownerProcedure
      .input(z.object({ collaboratorId: IdSchema.optional() }).optional())
      .query(({ ctx, input }) =>
        permissions.list(ctx.organizationId, input?.collaboratorId),
      ),

    set: ownerProcedure
      .input(SetPermissionSchema)
      .mutation(({ ctx, input }) => {
        const { collaboratorId, entityId, ...flags } = input;
        return permissions.set(
          ctx.organizationId,
          collaboratorId,
          entityId,
          flags,
        );
      }),

    remove: ownerProcedure
      .input(RemovePermissionSchema)
      .mutation(({ ctx, input }) =>
        permissions.remove(
          ctx.organizationId,
          input.collaboratorId,
          input.entityId,
        ),
      ),
  });
}
