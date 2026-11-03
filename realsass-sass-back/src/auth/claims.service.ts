// realsass-sass-back/src/auth/claims.service.ts
//
// Emite custom claims en el token Firebase para que los servicios de plataforma
// (chat-ia-back, etc.) puedan validar identidad y permisos sin llamar al sass-back.
//
// Referencia: ADR-003 — Contrato de custom claims Firebase
//
// Shape emitido:
// {
//   organizationId:   string,
//   organizationName: string,
//   organizationSlug: string,
//   role:             'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER',
//   permissions: {
//     chat: { canRead: boolean, canWrite: boolean }
//   }
// }
import { errorMessage } from '@real/auth-server';
import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth'; // @real/firebase-auth

export interface PlatformClaims {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string;
  permissions: {
    chat?: { canRead: boolean; canWrite: boolean };
  };
}

// Shape mínimo que necesitamos del perfil — independiente del tipo exacto
// que devuelve buildProfile() para evitar el error "organization: unknown"
export interface ProfileForClaims {
  tenants: Array<{
    organizationId: string;
    organization: Record<string, unknown>;
    role: string;
  }>;
}

/** Un campo de la organización solo vale si es texto (viene de un objeto suelto, no de un tipo). */
const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  // ── Emitir claims ─────────────────────────────────────────────────────────
  async setOrgClaims(uid: string, claims: PlatformClaims): Promise<void> {
    try {
      await getAuth().setCustomUserClaims(uid, claims);
      this.logger.log(
        `Claims emitidos → uid: ${uid} org: ${claims.organizationId} role: ${claims.role}`,
      );
    } catch (err) {
      // No rompemos el flujo de login si los claims fallan
      this.logger.error(
        `Error emitiendo claims para ${uid}: ${errorMessage(err)}`,
      );
    }
  }

  // ── Revocar refresh tokens ────────────────────────────────────────────────
  async revokeUserTokens(uid: string): Promise<void> {
    try {
      await getAuth().revokeRefreshTokens(uid);
      this.logger.warn(`Refresh tokens revocados → uid: ${uid}`);
    } catch (err) {
      this.logger.error(
        `Error revocando tokens para ${uid}: ${errorMessage(err)}`,
      );
    }
  }

  // ── Construir claims desde el perfil ─────────────────────────────────────
  buildClaimsFromProfile(profile: ProfileForClaims): PlatformClaims | null {
    if (!profile.tenants.length) return null;

    // OWNER tiene prioridad, luego el primero disponible
    const tenant =
      profile.tenants.find((t) => t.role === 'OWNER') ?? profile.tenants[0];

    const org = tenant.organization;

    return {
      organizationId: tenant.organizationId,
      organizationName: textOrNull(org['name']) ?? tenant.organizationId,
      organizationSlug: textOrNull(org['slug']) ?? '',
      role: this.mapRole(tenant.role),
      permissions: {
        chat: {
          canRead: true,
          canWrite: tenant.role !== 'VIEWER',
        },
      },
    };
  }

  private mapRole(ecosystemRole: string): string {
    const map: Record<string, string> = {
      OWNER: 'OWNER',
      COLLABORATOR: 'MEMBER',
      ADMIN: 'ADMIN',
      MEMBER: 'MEMBER',
      VIEWER: 'VIEWER',
    };
    return map[ecosystemRole] ?? 'VIEWER';
  }
}
