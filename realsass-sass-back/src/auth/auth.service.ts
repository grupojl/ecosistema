import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as admin            from 'firebase-admin';
import { PrismaService }     from '../prisma/prisma.service';
import { UsersService }      from '../users/users.service';
import { AffiliatesService } from '../affiliate/affiliate.service';
import type { CurrentUserPayload } from '@real/auth-server';

/**
 * AuthService — dos responsabilidades:
 *   1. syncUser()            — upsert del User en DB
 *   2. generateCustomToken() — SSO entre sass-front y dashboard-front
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly users:      UsersService,
    private readonly affiliates: AffiliatesService,
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
    return { isNew: true, user: profile! };
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
