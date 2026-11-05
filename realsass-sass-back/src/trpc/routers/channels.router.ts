/**
 * channels.router.ts — `canales.*` (welver-domain.md §15.3).
 *
 * Cualquier miembro ve el estado de los canales de los entes que puede ver; solo el dueño conecta, pausa y quita. Las
 * credenciales de Meta y TikTok nunca pasan por acá (la conexión real es la integración que sigue).
 */
import { router, tenantProcedure, ownerProcedure } from '@/trpc/trpc';
import type { ChannelsService } from '@/welver/channels/channels.service';
import { actorOf } from '@/trpc/routers/welver-actor';
import {
  ChannelIdSchema,
  RegisterChannelSchema,
} from '@/welver/welver.schemas';

export function createChannelsRouter(channels: ChannelsService) {
  return router({
    list: tenantProcedure.query(({ ctx }) => channels.list(actorOf(ctx))),

    register: ownerProcedure
      .input(RegisterChannelSchema)
      .mutation(({ ctx, input }) => channels.register(actorOf(ctx), input)),

    pause: ownerProcedure
      .input(ChannelIdSchema)
      .mutation(({ ctx, input }) => channels.pause(actorOf(ctx), input.id)),

    resume: ownerProcedure
      .input(ChannelIdSchema)
      .mutation(({ ctx, input }) => channels.resume(actorOf(ctx), input.id)),

    remove: ownerProcedure
      .input(ChannelIdSchema)
      .mutation(({ ctx, input }) => channels.remove(actorOf(ctx), input.id)),
  });
}
