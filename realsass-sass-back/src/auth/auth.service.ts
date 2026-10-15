// realsass-sass-back/src/auth/auth.service.ts
import { ForbiddenException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { getFirebaseAdmin } from '@real/auth-server';
import { USERS_REPOSITORY, type IUsersRepository } from '@/users/repository/users.repository.interface';
import type { UserAccount } from '@/domain/user.entity';
import { UsersService }      from '@/users/users.service';
import { AffiliatesService } from '@/affiliate/affiliate.service';
import { ClaimsService }     from '@/auth/claims.service';
import { OrganizationsService } from '@/organizations/organizations.service';
import { randomBytes }       from 'node:crypto';
import type { CurrentUserPayload } from '@real/auth-server';

/**
 * AuthService — tres responsabilidades:
 *   1. syncUser()            — upsert del User + emisión de custom claims (ADR-003)
 *   2. generateCustomToken() — SSO entre sass-front y dashboard-front
 *   3. refreshClaims()       — reemite claims (cambio de org activa)
 */
// Mapea UserProfile al shape que espera ClaimsService
// Hace explícito el contrato entre los dos servicios (ADR-007)
function toProfileForClaims(profile: {
  organizations:  Array<{ id: string; name: string | null; slug: string | null }>;
  collaborations: Array<{ organizationId: string; role: string; organization?: Record<string, unknown> }>;
}): import('@/auth/claims.service').ProfileForClaims {
  return {
    tenants: [
      // D3: las organizaciones propias entran como OWNER (ADR-003); antes solo se emitían las colaboraciones.
      ...profile.organizations.map(o => ({
        organizationId: o.id,
        organization:   { name: o.name, slug: o.slug },
        role:           'OWNER',
      })),
      ...profile.collaborations.map(c => ({
        organizationId: c.organizationId,
        organization:   c.organization ?? {},
        role:           c.role,
      })),
    ],
  };
}

/** D2: código de afiliado aleatorio y no adivinable (no deriva del id ni del uid). */
function generateAffiliateCode(): string {
  return 'ref-' + randomBytes(5).toString('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly accounts:   IUsersRepository,
    private readonly users:      UsersService,
    private readonly affiliates: AffiliatesService,
    private readonly claims:     ClaimsService,
    private readonly orgs:       OrganizationsService,
  ) {}

  /**
   * D1 + D2: todo usuario tiene código de afiliado y al menos una organización.
   * Idempotente: se llama en cada sync, así también repara cuentas creadas antes de esta regla.
   */
  private async ensureDefaults(user: Pick<UserAccount, 'id' | 'email' | 'displayName' | 'isOwner' | 'affiliateCode'>) {
    if (!user.affiliateCode) {
      await this.accounts.updateAccount(user.id, { affiliateCode: generateAffiliateCode() });
    }
    const { created } = await this.orgs.ensureDefaultOrganization(user);
    if ((created || !user.isOwner)) {
      await this.accounts.updateAccount(user.id, { isOwner: true });
    }
    if (created) this.logger.log('Organización por defecto creada para ' + user.email);
  }

  async syncUser(firebaseUser: CurrentUserPayload, affiliateCode?: string) {
    const existing = await this.accounts.findAccountByFirebaseUid(firebaseUser.uid);

    if (existing) {
      await this.accounts.updateAccount(existing.id, {
        displayName: firebaseUser.displayName ?? existing.displayName,
        avatarUrl:   firebaseUser.avatarUrl   ?? existing.avatarUrl,
      });
      this.logger.log(`Usuario sincronizado: ${existing.email}`);
      await this.ensureDefaults(existing);
      const profile = await this.users.buildProfile(firebaseUser.uid);

      // ── Emitir custom claims (ADR-003) ──────────────────────────────────
      if (profile && (profile.organizations.length || profile.collaborations.length)) {
        const platformClaims = this.claims.buildClaimsFromProfile(toProfileForClaims(profile));
        if (platformClaims) {
          await this.claims.setOrgClaims(firebaseUser.uid, platformClaims);
        }
      }

      return { isNew: false, user: profile };
    }

    const newUser = await this.accounts.createAccount({
      firebaseUid:   firebaseUser.uid,
      email:         firebaseUser.email,
      displayName:   firebaseUser.displayName,
      avatarUrl:     firebaseUser.avatarUrl,
      affiliateCode: generateAffiliateCode(),
    });

    this.logger.log(`Nuevo usuario: ${newUser.email}`);

    if (affiliateCode) {
      try {
        // Firma real: registerReferral(affiliateCode, newUserId). Antes se pasaban invertidos.
        await this.affiliates.registerReferral(affiliateCode, newUser.id);
      } catch (err) {
        this.logger.warn(`Error referido ${affiliateCode}: ${(err as Error).message}`);
      }
    }

    await this.ensureDefaults(newUser);
    const profile = await this.users.buildProfile(firebaseUser.uid);

    // ── Emitir custom claims para usuario nuevo ──────────────────────────
    if (profile && (profile.organizations.length || profile.collaborations.length)) {
      const platformClaims = this.claims.buildClaimsFromProfile(toProfileForClaims(profile));
      if (platformClaims) {
        await this.claims.setOrgClaims(firebaseUser.uid, platformClaims);
      }
    }

    return { isNew: true, user: profile };
  }

  // ── Reemitir claims (cambio de org activa) ───────────────────────────────
  async refreshClaims(firebaseUid: string): Promise<void> {
    const profile = await this.users.buildProfile(firebaseUid);
    if (!profile || !(profile.organizations.length || profile.collaborations.length)) return;

    const platformClaims = this.claims.buildClaimsFromProfile(toProfileForClaims(profile));
    if (platformClaims) {
      await this.claims.setOrgClaims(firebaseUid, platformClaims);
    }
  }

  /**
   * SSO sass-front → dashboard-front. La identidad sale de la sesión (cookie __session),
   * no de un idToken que el cliente tenga que reenviar.
   */
  async generateCustomTokenForUid(firebaseUid: string) {
    const access = await this.accounts.findAccessSummary(firebaseUid);
    if (!access) throw new UnauthorizedException('Usuario no registrado.');

    // Solo cuentan colaboraciones ACTIVAS: un colaborador removido o pendiente no obtiene token.
    const canAccess = access.organizationIds.length > 0 || access.activeCollaborations > 0;
    if (!canAccess) throw new ForbiddenException('El usuario no tiene acceso al dashboard.');

    const customToken = await getFirebaseAdmin().createCustomToken(firebaseUid, {
      isOwner:        access.organizationIds.length > 0,
      organizationId: access.organizationIds[0] ?? null,
    });
    this.logger.log('customToken SSO generado: ' + access.email);
    return { customToken };
  }

  async generateCustomToken(firebaseIdToken: string) {
    let decoded: Awaited<ReturnType<ReturnType<typeof getFirebaseAdmin>['verifyIdToken']>>;
    try {
      decoded = await getFirebaseAdmin().verifyIdToken(firebaseIdToken);
    } catch {
      throw new UnauthorizedException('Firebase idToken invalido o expirado');
    }

    const access = await this.accounts.findAccessSummary(decoded.uid);

    if (!access) throw new UnauthorizedException('Usuario no registrado. Llama a /auth/sync primero.');

    const canAccess = access.organizationIds.length > 0 || access.activeCollaborations > 0;
    if (!canAccess) throw new UnauthorizedException('El usuario no tiene acceso al dashboard.');

    const customToken = await getFirebaseAdmin().createCustomToken(decoded.uid, {
      isOwner:        access.organizationIds.length > 0,
      organizationId: access.organizationIds[0] ?? null,
    });

    this.logger.log(`customToken SSO generado: ${access.email}`);
    return { customToken, uid: decoded.uid, email: access.email };
  }
}
