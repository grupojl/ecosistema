/**
 * api-access.router.ts — `perfiles.*` y `claves.*` (v2, welver-domain.md §15.3).
 *
 * Solo el dueño, y solo con el flag `welver.api`. La clave en claro se devuelve una sola vez (al crear o rotar).
 * `internalVerify` es para el endpoint público de consulta (integración): valida una clave y devuelve su alcance.
 */
import { router, ownerProcedure, internalProcedure } from '@/trpc/trpc';
import type { ApiAccessService } from '@/welver/api-access/api-access.service';
import { actorOf } from '@/trpc/routers/welver-actor';
import {
  CreateKeySchema,
  CreateProfileSchema,
  InternalVerifyKeySchema,
  KeyIdSchema,
  ListKeysSchema,
  ProfileIdSchema,
  UpdateProfileSchema,
} from '@/welver/welver.schemas';

export function createProfilesRouter(api: ApiAccessService) {
  return router({
    list: ownerProcedure.query(({ ctx }) => api.listProfiles(actorOf(ctx))),

    create: ownerProcedure
      .input(CreateProfileSchema)
      .mutation(({ ctx, input }) => api.createProfile(actorOf(ctx), input)),

    update: ownerProcedure
      .input(UpdateProfileSchema)
      .mutation(({ ctx, input }) => {
        const { id, ...patch } = input;
        return api.updateProfile(actorOf(ctx), id, patch);
      }),

    remove: ownerProcedure
      .input(ProfileIdSchema)
      .mutation(({ ctx, input }) => api.removeProfile(actorOf(ctx), input.id)),
  });
}

export function createKeysRouter(api: ApiAccessService) {
  return router({
    list: ownerProcedure
      .input(ListKeysSchema.optional())
      .query(({ ctx, input }) => api.listKeys(actorOf(ctx), input?.profileId)),

    create: ownerProcedure
      .input(CreateKeySchema)
      .mutation(({ ctx, input }) =>
        api.createKey(actorOf(ctx), input.profileId, input.name),
      ),

    rotate: ownerProcedure
      .input(KeyIdSchema)
      .mutation(({ ctx, input }) => api.rotateKey(actorOf(ctx), input.id)),

    revoke: ownerProcedure
      .input(KeyIdSchema)
      .mutation(({ ctx, input }) => api.revokeKey(actorOf(ctx), input.id)),

    internalVerify: internalProcedure
      .input(InternalVerifyKeySchema)
      .mutation(({ input }) => api.verifyKey(input.key)),
  });
}
