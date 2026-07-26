import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCollaborators,
  inviteCollaborator,
  removeCollaborator,
  updateCollaboratorPermissions,
} from '@/lib/api';
import type { CollaboratorPermissions } from '@/lib/types';

export function useCollaborators() {
  return useQuery({
    queryKey:  ['collaborators'],
    queryFn:   () => listCollaborators().then(r => r.data),
    staleTime: 30_000,
  });
}

export function useInviteCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inviteCollaborator,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['collaborators'] }),
  });
}

export function useRemoveCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeCollaborator(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['collaborators'] }),
  });
}

export function useUpdateCollaboratorPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, perms }: { id: string; perms: Partial<CollaboratorPermissions> }) =>
      updateCollaboratorPermissions(id, perms),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collaborators'] }),
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (token: string) => 
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/collaborators/invitations/${token}/accept`, {
        method: 'POST',
      }).then(r => r.json()),
  });
}