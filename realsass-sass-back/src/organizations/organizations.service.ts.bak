import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una organización vacía para un usuario Owner.
   * Acepta un cliente Prisma de transacción (tx) o el servicio estándar.
   */
  async createForUser(userId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;

    return client.organization.create({
      data: {
        userId,
      },
    });
  }

  /**
   * PATCH /organizations/me
   * Actualiza el perfil de la organización del usuario autenticado.
   * Solo el Owner de la organización puede editarla.
   */
  async updateMyOrganization(
    firebaseUid: string,
    dto: UpdateOrganizationDto,
  ) {
    // Buscar usuario y verificar que sea owner
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: { organization: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.isOwner) {
      throw new ForbiddenException(
        'Solo los usuarios con rol Owner pueden editar una organización',
      );
    }

    if (!user.organization) {
      throw new NotFoundException(
        'No se encontró una organización asociada a este usuario',
      );
    }

    // Filtrar solo los campos enviados (no pisamos con undefined)
    const dataToUpdate: Prisma.OrganizationUpdateInput = {};
    if (dto.name !== undefined) dataToUpdate.name = dto.name;
    if (dto.description !== undefined) dataToUpdate.description = dto.description;
    if (dto.logoUrl !== undefined) dataToUpdate.logoUrl = dto.logoUrl;
    if (dto.website !== undefined) dataToUpdate.website = dto.website;
    if (dto.phone !== undefined) dataToUpdate.phone = dto.phone;
    if (dto.address !== undefined) dataToUpdate.address = dto.address;

    const updated = await this.prisma.organization.update({
      where: { id: user.organization.id },
      data: dataToUpdate,
    });

    this.logger.log(
      `Organización actualizada: ${updated.id} por usuario ${user.email}`,
    );

    return {
      success: true,
      message: 'Organización actualizada exitosamente',
      data: updated,
    };
  }

  /**
   * GET /organizations/me
   * Retorna la organización del usuario autenticado.
   */
  async getMyOrganization(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: { organization: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.organization) {
      throw new NotFoundException(
        'No se encontró una organización asociada a este usuario',
      );
    }

    return {
      success: true,
      data: user.organization,
    };
  }

  async findByUserId(userId: string) {
    return this.prisma.organization.findUnique({
      where: { userId },
      include: { user: true },
    });
  }
}