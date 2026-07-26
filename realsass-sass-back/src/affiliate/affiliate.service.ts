import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AffiliatesService {
  private readonly logger = new Logger(AffiliatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /affiliates/me
   * Retorna el perfil del afiliado con su código, balance y total de referidos.
   */
  async getMyProfile(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: { affiliateData: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.isAffiliate || !user.affiliateData) {
      throw new ForbiddenException(
        'Este usuario no tiene el rol de Afiliado activo',
      );
    }

    return {
      success: true,
      data: {
        affiliateCode: user.affiliateCode,
        balance: user.affiliateData.balance,
        referralCount: user.affiliateData.referralCount,
        createdAt: user.affiliateData.createdAt,
      },
    };
  }

  /**
   * GET /affiliates/me/referrals
   * Retorna el listado de usuarios que se registraron con el código del afiliado.
   */
  async getMyReferrals(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.isAffiliate || !user.affiliateCode) {
      throw new ForbiddenException(
        'Este usuario no tiene el rol de Afiliado activo',
      );
    }

    const referrals = await this.prisma.user.findMany({
      where: { referredByCode: user.affiliateCode },
      select: {
        id: true,
        email: true,
        isOwner: true,
        isAffiliate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: {
        affiliateCode: user.affiliateCode,
        total: referrals.length,
        referrals,
      },
    };
  }

  /**
   * Registra un referido: se llama desde AuthService cuando un nuevo
   * usuario se sincroniza con un código de afiliado válido.
   *
   * - Incrementa referralCount en AffiliateData del afiliado.
   * - Guarda referredByCode en el nuevo usuario.
   * Nota: la lógica de acreditar balance queda desacoplada aquí
   * para que puedas extenderla (ej: acreditar solo si el referido
   * completa onboarding o paga suscripción).
   */
  async registerReferral(
    newUserId: string,
    affiliateCode: string,
  ): Promise<void> {
    // Buscar al afiliado dueño del código
    const affiliate = await this.prisma.user.findUnique({
      where: { affiliateCode },
      include: { affiliateData: true },
    });

    if (!affiliate || !affiliate.isAffiliate || !affiliate.affiliateData) {
      this.logger.warn(
        `Código de afiliado inválido o sin datos: ${affiliateCode}`,
      );
      return; // No rompemos el flujo de registro si el código no es válido
    }

    // Transacción: guardar referredByCode + incrementar contador
    await this.prisma.$transaction(async (tx) => {
      // Marcar al nuevo usuario con el código que usó
      await tx.user.update({
        where: { id: newUserId },
        data: { referredByCode: affiliateCode },
      });

      // Incrementar el contador del afiliado
      await tx.affiliateData.update({
        where: { userId: affiliate.id },
        data: {
          referralCount: { increment: 1 },
        },
      });
    });

    this.logger.log(
      `Referido registrado: usuario ${newUserId} via código ${affiliateCode} (afiliado: ${affiliate.email})`,
    );
  }
}