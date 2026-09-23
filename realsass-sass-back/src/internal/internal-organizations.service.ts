// realsass-sass-back/src/internal/internal-organizations.service.ts
//
// Lógica de negocio para los endpoints internos de organizations.
// Usa PrismaService directamente — surface cross-tenant para superadmin.
//
// Dos dimensiones de control (norte Shopify Partners):
//   status      → panel administrativo (ACTIVE | SUSPENDED | BLOCKED)
//   storeStatus → storefront público (ACTIVE | PAUSED)
//
// Son independientes: una org puede tener el panel suspendido
// pero la tienda activa, o viceversa. Decisión explícita del operador.
//
// Flujo de bloqueo del storefront:
//   storeStatus = PAUSED
//   → GET /auth/organization-by-slug devuelve ecommerceEnabled: false
//   → StoreService (ecommerce-back) lanza NOT_FOUND
//   → Storefront muestra 404 sin cambios en ecommerce-back
import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { InternalListOrgsDto } from '@/internal/schemas';

export interface InternalOrgItem {
  id:           string;
  ecosystemId:  string;
  name:         string | null;
  slug:         string | null;
  status:       'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
  storeStatus:  'ACTIVE' | 'PAUSED';
  plan:         string;
  createdAt:    string;
  suspendedAt?: string;
}

export interface InternalOrgList {
  data:  InternalOrgItem[];
  total: number;
  page:  number;
  limit: number;
}

@Injectable()
export class InternalOrganizationsService {
  private readonly logger = new Logger(InternalOrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Mapear Prisma → shape esperado por superadmin ──────────────────────────
  private toItem(org: {
    id:          string;
    ecosystemId: string | null;
    name:        string | null;
    slug:        string | null;
    status:      string;
    storeStatus: string;
    plan:        string | null;
    createdAt:   Date;
    suspendedAt: Date | null;
  }): InternalOrgItem {
    return {
      id:           org.id,
      ecosystemId:  org.ecosystemId ?? 'welver',
      name:         org.name,
      slug:         org.slug,
      status:       org.status as 'ACTIVE' | 'SUSPENDED' | 'BLOCKED',
      storeStatus:  org.storeStatus as 'ACTIVE' | 'PAUSED',
      plan:         org.plan ?? 'free',
      createdAt:    org.createdAt.toISOString(),
      suspendedAt:  org.suspendedAt?.toISOString(),
    };
  }

  private get select() {
    return {
      id:          true,
      ecosystemId: true,
      name:        true,
      slug:        true,
      status:      true,
      storeStatus: true,
      plan:        true,
      createdAt:   true,
      suspendedAt: true,
    } as const;
  }

  // ── GET /internal/organizations ────────────────────────────────────────────
  async findAll(dto: InternalListOrgsDto): Promise<InternalOrgList> {
    const { ecosystemId, status, storeStatus, page, limit, search } = dto;
    const skip = (page - 1) * limit;

    const where = {
      ...(ecosystemId  ? { ecosystemId }  : {}),
      ...(status       ? { status }       : {}),
      ...(storeStatus  ? { storeStatus }  : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { slug: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        select: this.select,
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return { data: data.map((o) => this.toItem(o)), total, page, limit };
  }

  // ── GET /internal/organizations/:id ────────────────────────────────────────
  async findById(id: string): Promise<InternalOrgItem> {
    const org = await this.prisma.organization.findUnique({
      where:  { id },
      select: this.select,
    });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return this.toItem(org);
  }

  // ── POST /internal/organizations/:id/suspend ───────────────────────────────
  async suspend(id: string, reason: string): Promise<InternalOrgItem> {
    const org = await this.prisma.organization.findUnique({
      where: { id }, select: { id: true, status: true },
    });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    if (org.status === 'SUSPENDED') throw new ConflictException('Organization is already suspended');
    if (org.status === 'BLOCKED')   throw new ConflictException('Organization is blocked — cannot suspend');

    this.logger.log(`[suspend] org=${id} reason="${reason}"`);

    const updated = await this.prisma.organization.update({
      where:  { id },
      data:   { status: 'SUSPENDED', suspendedAt: new Date() },
      select: this.select,
    });
    return this.toItem(updated);
  }

  // ── POST /internal/organizations/:id/unsuspend ─────────────────────────────
  async unsuspend(id: string, reason: string): Promise<InternalOrgItem> {
    const org = await this.prisma.organization.findUnique({
      where: { id }, select: { id: true, status: true },
    });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    if (org.status !== 'SUSPENDED') throw new ConflictException('Organization is not suspended');

    this.logger.log(`[unsuspend] org=${id} reason="${reason}"`);

    const updated = await this.prisma.organization.update({
      where:  { id },
      data:   { status: 'ACTIVE', suspendedAt: null },
      select: this.select,
    });
    return this.toItem(updated);
  }

  // ── POST /internal/organizations/:id/pause-store ───────────────────────────
  async pauseStore(id: string, reason: string): Promise<InternalOrgItem> {
    const org = await this.prisma.organization.findUnique({
      where: { id }, select: { id: true, storeStatus: true },
    });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    if (org.storeStatus === 'PAUSED') throw new ConflictException('Store is already paused');

    this.logger.log(`[pause-store] org=${id} reason="${reason}"`);

    const updated = await this.prisma.organization.update({
      where:  { id },
      data:   { storeStatus: 'PAUSED' },
      select: this.select,
    });
    return this.toItem(updated);
  }

  // ── POST /internal/organizations/:id/resume-store ──────────────────────────
  async resumeStore(id: string, reason: string): Promise<InternalOrgItem> {
    const org = await this.prisma.organization.findUnique({
      where: { id }, select: { id: true, storeStatus: true },
    });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    if (org.storeStatus === 'ACTIVE') throw new ConflictException('Store is already active');

    this.logger.log(`[resume-store] org=${id} reason="${reason}"`);

    const updated = await this.prisma.organization.update({
      where:  { id },
      data:   { storeStatus: 'ACTIVE' },
      select: this.select,
    });
    return this.toItem(updated);
  }
}
