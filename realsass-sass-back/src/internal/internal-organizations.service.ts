// realsass-sass-back/src/internal/internal-organizations.service.ts
//
// Lógica de negocio para los endpoints internos de organizations.
// Superficie cross-tenant para superadmin; la persistencia va por IInternalOrganizationsRepository.
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
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import {
  INTERNAL_ORGANIZATIONS_REPOSITORY,
  type IInternalOrganizationsRepository,
  type InternalOrgRow,
} from '@/internal/repository/internal-organizations.repository.interface';
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

  constructor(
    @Inject(INTERNAL_ORGANIZATIONS_REPOSITORY)
    private readonly repo: IInternalOrganizationsRepository,
  ) {}

  // ── Mapear fila → shape esperado por superadmin ────────────────────────────
  private toItem(org: InternalOrgRow): InternalOrgItem {
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

  private async require(id: string): Promise<InternalOrgRow> {
    const org = await this.repo.findById(id);
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  // ── GET /internal/organizations ────────────────────────────────────────────
  async findAll(dto: InternalListOrgsDto): Promise<InternalOrgList> {
    const { ecosystemId, status, storeStatus, page, limit, search } = dto;
    const { rows, total } = await this.repo.list({ ecosystemId, status, storeStatus, search }, page, limit);
    return { data: rows.map((o) => this.toItem(o)), total, page, limit };
  }

  // ── GET /internal/organizations/:id ────────────────────────────────────────
  async findById(id: string): Promise<InternalOrgItem> {
    return this.toItem(await this.require(id));
  }

  // ── POST /internal/organizations/:id/suspend ───────────────────────────────
  async suspend(id: string, reason: string): Promise<InternalOrgItem> {
    const org = await this.require(id);
    if (org.status === 'SUSPENDED') throw new ConflictException('Organization is already suspended');
    if (org.status === 'BLOCKED')   throw new ConflictException('Organization is blocked — cannot suspend');

    this.logger.log(`[suspend] org=${id} reason="${reason}"`);
    return this.toItem(await this.repo.suspend(id, new Date()));
  }

  // ── POST /internal/organizations/:id/unsuspend ─────────────────────────────
  async unsuspend(id: string, reason: string): Promise<InternalOrgItem> {
    const org = await this.require(id);
    if (org.status !== 'SUSPENDED') throw new ConflictException('Organization is not suspended');

    this.logger.log(`[unsuspend] org=${id} reason="${reason}"`);
    return this.toItem(await this.repo.unsuspend(id));
  }

  // ── POST /internal/organizations/:id/pause-store ───────────────────────────
  async pauseStore(id: string, reason: string): Promise<InternalOrgItem> {
    const org = await this.require(id);
    if (org.storeStatus === 'PAUSED') throw new ConflictException('Store is already paused');

    this.logger.log(`[pause-store] org=${id} reason="${reason}"`);
    return this.toItem(await this.repo.setStoreStatus(id, 'PAUSED'));
  }

  // ── POST /internal/organizations/:id/resume-store ──────────────────────────
  async resumeStore(id: string, reason: string): Promise<InternalOrgItem> {
    const org = await this.require(id);
    if (org.storeStatus === 'ACTIVE') throw new ConflictException('Store is already active');

    this.logger.log(`[resume-store] org=${id} reason="${reason}"`);
    return this.toItem(await this.repo.setStoreStatus(id, 'ACTIVE'));
  }
}
