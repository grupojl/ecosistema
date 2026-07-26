import * as admin from 'firebase-admin';
import { UnauthorizedException } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AffiliatesService } from '../affiliate/affiliate.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly affiliatesService: AffiliatesService,
  ) {}

  /**
   * POST /auth/sync
   * Crea o actualiza el usuario. Devuelve el perfil completo.
   */
  async syncUser(firebaseUser: CurrentUserPayload, affiliateCode?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid: firebaseUser.uid },
    });

    if (existing) {
      this.logger.log(`Usuario existente sincronizado: ${existing.email}`);
      const profile = await this.usersService.buildProfile(firebaseUser.uid);
      return { user: profile, isNew: false };
    }

    // Crear nuevo usuario
    const newUser = await this.prisma.user.create({
      data: {
        firebaseUid: firebaseUser.uid,
        email:       firebaseUser.email,
        isOwner:     false,
        isAffiliate: false,
      },
    });

    this.logger.log(`Nuevo usuario creado: ${newUser.email}`);

    // Registrar referido si vino código de afiliado
    if (affiliateCode) {
      try {
        await this.affiliatesService.registerReferral(newUser.id, affiliateCode);
      } catch (err: any) {
        this.logger.warn(`Error al registrar referido con código ${affiliateCode}: ${err.message}`);
      }
    }

    const profile = await this.usersService.buildProfile(firebaseUser.uid);
    return { user: profile, isNew: true };
  }

  /**
   * POST /auth/firebase-sso
   * Verifica el idToken de Firebase del sass-front y genera un customToken
   * para que el dashboard-front pueda hacer signInWithCustomToken sin pedir
   * password de nuevo al usuario.
   *
   * Seguridad:
   *   - El idToken se verifica con Firebase Admin (no es confiable por sí solo)
   *   - El customToken tiene TTL de 1 hora (Firebase default)
   *   - Solo se genera para usuarios que existen en nuestra DB (isOwner o collaborator)
   */
  async generateCustomToken(firebaseIdToken: string): Promise<{
    customToken: string;
    uid: string;
    email: string | null;
  }> {
    // 1. Verificar el idToken con Firebase Admin
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.app().auth().verifyIdToken(firebaseIdToken);
    } catch {
      throw new UnauthorizedException('Firebase idToken inválido o expirado');
    }

    // 2. Verificar que el usuario existe en nuestra DB y tiene acceso al dashboard
    const user = await this.prisma.user.findUnique({
      where:   { firebaseUid: decoded.uid },
      include: { organization: true, collaborations: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no registrado. Hacé sync primero.');
    }

    const canAccessDashboard = user.isOwner || (user.collaborations?.length ?? 0) > 0;
    if (!canAccessDashboard) {
      throw new UnauthorizedException('El usuario no tiene acceso al dashboard.');
    }

    // 3. Generar customToken con Firebase Admin
    const customToken = await admin.app().auth().createCustomToken(decoded.uid, {
      isOwner:        user.isOwner,
      organizationId: user.organization?.id ?? null,
    });

    this.logger.log(`SSO customToken generado para: ${user.email}`);

    return {
      customToken,
      uid:   decoded.uid,
      email: user.email,
    };
  }
}
