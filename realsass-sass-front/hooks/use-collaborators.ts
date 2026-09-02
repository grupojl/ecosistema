/**
 * hooks/use-collaborators.ts — realsass-sass-front
 *
 * Hooks TanStack Query para gestión de colaboradores via tRPC.
 * Reemplaza las llamadas a lib/api.ts (listCollaborators, inviteCollaborator, etc.)
 * Tipado completo inferido desde SassAppRouter.
 */
import { useQueryClient } from '@tanstack/react-query';
import { trpc }           from '@/lib/trpc/client';

// ── Lista de colaboradores ────────────────────────────────────────────────────

export function useCollaborators() {
  return trpc.collaborators.list.useQuery(undefined, {
    staleTime: 30 * 1000,
  });
}

// ── Invitar colaborador ───────────────────────────────────────────────────────

export function useInviteCollaborator() {
  const queryClient = useQueryClient();
  return trpc.collaborators.invite.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['collaborators', 'list']] });
    },
  });
}

// ── Actualizar permisos ───────────────────────────────────────────────────────

export function useUpdateCollaboratorPermissions() {
  const queryClient = useQueryClient();
  return trpc.collaborators.update.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['collaborators', 'list']] });
    },
  });
}

// ── Eliminar colaborador ──────────────────────────────────────────────────────

export function useRemoveCollaborator() {
  const queryClient = useQueryClient();
  return trpc.collaborators.remove.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['collaborators', 'list']] });
    },
  });
}

// ── Aceptar invitación (usuario autenticado) ──────────────────────────────────

export function useAcceptInvitation() {
  return trpc.collaborators.acceptInvitation.useMutation();
}

// ── Info de invitación por token (@Public — sin auth requerida) ───────────────

export function useInvitationInfo(token: string | null | undefined) {
  return trpc.collaborators.getInvitationInfo.useQuery(
    { token: token! },
    { enabled: !!token },
  );
}
