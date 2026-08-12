#!/usr/bin/env bash
# =============================================================================
# x.sh — Sprint 3 / ADR-001: ClaimsService en realsass-sass-back
# Repo: grupojl/ecosistema (raíz del monorepo welver/)
#
# Qué hace:
#   1. Crea realsass-sass-back/src/auth/claims.service.ts
#   2. Reescribe realsass-sass-back/src/auth/auth.service.ts  (agrega ClaimsService)
#   3. Reescribe realsass-sass-back/src/auth/auth.module.ts   (registra ClaimsService)
#   4. Reescribe realsass-sass-back/src/auth/auth.controller.ts (agrega refresh-claims)
#
# USO (desde raíz del monorepo welver/):
#   bash x.sh
#   bash x.sh --dry-run
#
# Después:
#   pnpm --filter realsass-sass-back build
# =============================================================================
set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
log()     { echo -e "${BLUE}[→]${NC} $1"; }
ok()      { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
err()     { echo -e "${RED}[✗]${NC} $1"; exit 1; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SASS_BACK="$ROOT/realsass-sass-back"

[[ -f "$ROOT/pnpm-workspace.yaml" ]]           || err "Ejecutá desde la raíz del monorepo (welver/)"
[[ -d "$SASS_BACK/src/auth" ]]                 || err "No encontré realsass-sass-back/src/auth"
[[ -f "$SASS_BACK/src/auth/auth.service.ts" ]] || err "No encontré auth.service.ts"

[[ "$DRY_RUN" == true ]] && warn "DRY-RUN — no se escribirá nada"

write_file() {
  local rel="$1"; local full="$ROOT/$rel"
  mkdir -p "$(dirname "$full")"
  if [[ "$DRY_RUN" == true ]]; then warn "[DRY] write → $rel"; return; fi
  [[ -f "$full" ]] && cp "$full" "${full}.bak" && log "backup → ${rel}.bak"
  cat > "$full"
  ok "write → $rel"
}

# =============================================================================
# 1 — claims.service.ts (archivo nuevo)
# =============================================================================
section "1/4 — claims.service.ts"

write_file "realsass-sass-back/src/auth/claims.service.ts" << 'EOF'
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
import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

export interface PlatformClaims {
  organizationId:   string;
  organizationName: string;
  organizationSlug: string;
  role:             string;
  permissions: {
    chat?: { canRead: boolean; canWrite: boolean };
  };
}

// Shape mínimo que necesitamos del perfil — independiente del tipo exacto
// que devuelve buildProfile() para evitar el error "organization: unknown"
interface ProfileForClaims {
  tenants: Array<{
    organizationId: string;
    organization:   Record<string, unknown>;
    role:           string;
  }>;
}

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  // ── Emitir claims ─────────────────────────────────────────────────────────
  async setOrgClaims(uid: string, claims: PlatformClaims): Promise<void> {
    try {
      await admin.app().auth().setCustomUserClaims(uid, claims);
      this.logger.log(
        `Claims emitidos → uid: ${uid} org: ${claims.organizationId} role: ${claims.role}`,
      );
    } catch (err) {
      // No rompemos el flujo de login si los claims fallan
      this.logger.error(`Error emitiendo claims para ${uid}: ${(err as Error).message}`);
    }
  }

  // ── Revocar refresh tokens ────────────────────────────────────────────────
  async revokeUserTokens(uid: string): Promise<void> {
    try {
      await admin.app().auth().revokeRefreshTokens(uid);
      this.logger.warn(`Refresh tokens revocados → uid: ${uid}`);
    } catch (err) {
      this.logger.error(`Error revocando tokens para ${uid}: ${(err as Error).message}`);
    }
  }

  // ── Construir claims desde el perfil ─────────────────────────────────────
  buildClaimsFromProfile(profile: ProfileForClaims): PlatformClaims | null {
    if (!profile.tenants.length) return null;

    // OWNER tiene prioridad, luego el primero disponible
    const tenant =
      profile.tenants.find((t) => t.role === 'OWNER') ?? profile.tenants[0]!;

    const org = tenant.organization;

    return {
      organizationId:   tenant.organizationId,
      organizationName: (org['name'] as string | null) ?? tenant.organizationId,
      organizationSlug: (org['slug'] as string | null) ?? '',
      role:             this.mapRole(tenant.role),
      permissions: {
        chat: {
          canRead:  true,
          canWrite: tenant.role !== 'VIEWER',
        },
      },
    };
  }

  private mapRole(ecosystemRole: string): string {
    const map: Record<string, string> = {
      OWNER:        'OWNER',
      COLLABORATOR: 'MEMBER',
      ADMIN:        'ADMIN',
      MEMBER:       'MEMBER',
      VIEWER:       'VIEWER',
    };
    return map[ecosystemRole] ?? 'VIEWER';
  }
}
EOF

# =============================================================================
# 2 — auth.service.ts (reescritura completa con ClaimsService)
# =============================================================================
section "2/4 — auth.service.ts"

write_file "realsass-sass-back/src/auth/auth.service.ts" << 'EOF'
// realsass-sass-back/src/auth/auth.service.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as admin            from 'firebase-admin';
import { PrismaService }     from '../prisma/prisma.service';
import { UsersService }      from '../users/users.service';
import { AffiliatesService } from '../affiliate/affiliate.service';
import { ClaimsService }     from './claims.service';
import type { CurrentUserPayload } from '@real/auth-server';

/**
 * AuthService — tres responsabilidades:
 *   1. syncUser()            — upsert del User + emisión de custom claims (ADR-003)
 *   2. generateCustomToken() — SSO entre sass-front y dashboard-front
 *   3. refreshClaims()       — reemite claims (cambio de org activa)
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly users:      UsersService,
    private readonly affiliates: AffiliatesService,
    private readonly claims:     ClaimsService,
  ) {}

  async syncUser(firebaseUser: CurrentUserPayload, affiliateCode?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid: firebaseUser.uid },
    });

    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          displayName: firebaseUser.displayName ?? existing.displayName,
          avatarUrl:   firebaseUser.avatarUrl   ?? existing.avatarUrl,
        },
      });
      this.logger.log(`Usuario sincronizado: ${existing.email}`);
      const profile = await this.users.buildProfile(firebaseUser.uid);

      // ── Emitir custom claims (ADR-003) ──────────────────────────────────
      if (profile?.tenants.length) {
        const platformClaims = this.claims.buildClaimsFromProfile(profile);
        if (platformClaims) {
          await this.claims.setOrgClaims(firebaseUser.uid, platformClaims);
        }
      }

      return { isNew: false, user: profile! };
    }

    const newUser = await this.prisma.user.create({
      data: {
        firebaseUid: firebaseUser.uid,
        email:       firebaseUser.email,
        displayName: firebaseUser.displayName,
        avatarUrl:   firebaseUser.avatarUrl,
        isOwner:     false,
        isAffiliate: false,
      },
    });

    this.logger.log(`Nuevo usuario: ${newUser.email}`);

    if (affiliateCode) {
      try {
        await this.affiliates.registerReferral(newUser.id, affiliateCode);
      } catch (err) {
        this.logger.warn(`Error referido ${affiliateCode}: ${(err as Error).message}`);
      }
    }

    const profile = await this.users.buildProfile(firebaseUser.uid);

    // ── Emitir custom claims para usuario nuevo ──────────────────────────
    if (profile?.tenants.length) {
      const platformClaims = this.claims.buildClaimsFromProfile(profile);
      if (platformClaims) {
        await this.claims.setOrgClaims(firebaseUser.uid, platformClaims);
      }
    }

    return { isNew: true, user: profile! };
  }

  // ── Reemitir claims (cambio de org activa) ───────────────────────────────
  async refreshClaims(firebaseUid: string): Promise<void> {
    const profile = await this.users.buildProfile(firebaseUid);
    if (!profile?.tenants.length) return;

    const platformClaims = this.claims.buildClaimsFromProfile(profile);
    if (platformClaims) {
      await this.claims.setOrgClaims(firebaseUid, platformClaims);
    }
  }

  async generateCustomToken(firebaseIdToken: string) {
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.app().auth().verifyIdToken(firebaseIdToken);
    } catch {
      throw new UnauthorizedException('Firebase idToken invalido o expirado');
    }

    const user = await this.prisma.user.findUnique({
      where:   { firebaseUid: decoded.uid },
      include: { organization: true, collaborations: true },
    });

    if (!user) throw new UnauthorizedException('Usuario no registrado. Llama a /auth/sync primero.');

    const canAccess = user.isOwner || (user.collaborations?.length ?? 0) > 0;
    if (!canAccess) throw new UnauthorizedException('El usuario no tiene acceso al dashboard.');

    const customToken = await admin.app().auth().createCustomToken(decoded.uid, {
      isOwner:        user.isOwner,
      organizationId: user.organization?.id ?? null,
    });

    this.logger.log(`customToken SSO generado: ${user.email}`);
    return { customToken, uid: decoded.uid, email: user.email };
  }
}
EOF

# =============================================================================
# 3 — auth.module.ts (reescritura completa con ClaimsService)
# =============================================================================
section "3/4 — auth.module.ts"

write_file "realsass-sass-back/src/auth/auth.module.ts" << 'EOF'
// realsass-sass-back/src/auth/auth.module.ts
import { Module }           from '@nestjs/common';
import { AuthController }   from './auth.controller';
import { AuthService }      from './auth.service';
import { ClaimsService }    from './claims.service';
import { UsersModule }      from '../users/users.module';
import { AffiliatesModule } from '../affiliate/affiliate.module';

@Module({
  imports:     [UsersModule, AffiliatesModule],
  controllers: [AuthController],
  providers:   [AuthService, ClaimsService],
  exports:     [AuthService, ClaimsService],
})
export class AuthModule {}
EOF

# =============================================================================
# 4 — auth.controller.ts (reescritura completa con refresh-claims)
# =============================================================================
section "4/4 — auth.controller.ts"

write_file "realsass-sass-back/src/auth/auth.controller.ts" << 'EOF'
// realsass-sass-back/src/auth/auth.controller.ts
import {
  Body, Controller, Get, Headers,
  HttpCode, HttpStatus, NotFoundException, Post, Query,
} from '@nestjs/common';
import { AuthService }                                  from './auth.service';
import { UsersService }                                 from '../users/users.service';
import { Public, CurrentUser, type CurrentUserPayload } from '@real/auth-server';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth:  AuthService,
    private readonly users: UsersService,
  ) {}

  /** POST /api/v1/auth/sync — crea o actualiza el usuario. Idempotente. */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async sync(
    @CurrentUser() user: CurrentUserPayload,
    @Query('ref') affiliateCode?: string,
  ) {
    const result = await this.auth.syncUser(user, affiliateCode);
    return {
      success: true,
      isNew:   result.isNew,
      message: result.isNew ? 'Usuario creado' : 'Usuario sincronizado',
      data:    result.user,
    };
  }

  /** GET /api/v1/auth/me — perfil completo. */
  @Get('me')
  async me(@CurrentUser() user: CurrentUserPayload) {
    const profile = await this.users.getMyProfile(user.uid);
    if (!profile) throw new NotFoundException('Usuario no encontrado. Llama a /auth/sync primero.');
    return { success: true, data: profile };
  }

  /** GET /api/v1/auth/organization-access — contrato con ecommerce-back. */
  @Get('organization-access')
  async organizationAccess(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') organizationId: string,
  ) {
    if (!organizationId) return { canAccess: false, reason: 'Header x-organization-id requerido' };
    return this.users.getOrganizationAccess(user.uid, organizationId);
  }

  /** POST /api/v1/auth/firebase-sso — SSO publico entre fronts. */
  @Public()
  @Post('firebase-sso')
  @HttpCode(HttpStatus.OK)
  async firebaseSso(@Body() body: { firebaseIdToken?: string }) {
    if (!body?.firebaseIdToken) throw new NotFoundException('firebaseIdToken requerido');
    const result = await this.auth.generateCustomToken(body.firebaseIdToken);
    return { success: true, ...result };
  }

  /**
   * POST /api/v1/auth/refresh-claims
   * Reemite custom claims Firebase para el usuario actual (ADR-003).
   * El frontend debe llamar getIdToken(true) después para obtener el token fresco.
   */
  @Post('refresh-claims')
  @HttpCode(HttpStatus.OK)
  async refreshClaims(@CurrentUser() user: CurrentUserPayload) {
    await this.auth.refreshClaims(user.uid);
    return {
      success: true,
      message: 'Claims actualizados — solicitá un token fresco con getIdToken(true)',
    };
  }
}
EOF

# =============================================================================
section "Sprint 3 completado"

echo ""
echo "  Archivos creados:"
echo "    + realsass-sass-back/src/auth/claims.service.ts"
echo ""
echo "  Archivos reescritos:"
echo "    ~ realsass-sass-back/src/auth/auth.service.ts"
echo "    ~ realsass-sass-back/src/auth/auth.module.ts"
echo "    ~ realsass-sass-back/src/auth/auth.controller.ts"
echo ""
echo "  Próximos pasos:"
echo ""
echo "  1. pnpm --filter realsass-sass-back build"
echo "  2. git add . && git commit -m 'feat(adr-001): sprint-3 claims service'"
echo ""
echo "  Flujo completo verificado cuando:"
echo "    login → POST /auth/sync → claims emitidos → request a chat-ia-back → 200"