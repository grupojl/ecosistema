'use client';

import type { UserProfile } from '@real/auth-client';

export { AuthProvider, useAuth } from '@real/auth-client';
export type { UserProfile }      from '@real/auth-client';

/** Alias tipado del perfil de usuario en el dashboard. */
export type DashboardUser = UserProfile;
