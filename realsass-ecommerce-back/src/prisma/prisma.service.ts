import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg }    from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma';
import { TenantAwarePool } from '@/prisma/tenant-aware-pool';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const pool    = new TenantAwarePool({ connectionString: process.env['DATABASE_URL'] });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.assertRlsEffective();
  }

  /**
   * ADR-027: un rol SUPERUSER o con BYPASSRLS ignora las políticas, aun con FORCE ROW LEVEL SECURITY.
   * En producción el servicio NO arranca así (falla cerrado); en otros entornos solo avisa.
   * ALLOW_RLS_BYPASS_ROLE=true lo habilita de forma consciente (p. ej. un entorno efímero).
   */
  private async assertRlsEffective(): Promise<void> {
    const rows = await this.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;
    const role = rows[0];
    if (!role || (!role.rolsuper && !role.rolbypassrls)) return;

    const message = 'El rol de la base es SUPERUSER o BYPASSRLS: Row Level Security NO se aplica (ADR-027).';
    if (process.env['NODE_ENV'] === 'production' && process.env['ALLOW_RLS_BYPASS_ROLE'] !== 'true') {
      throw new Error(message + ' Usá el rol de aplicación (ver prisma/rls/app-role.sql).');
    }
    this.logger.warn(message);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * PrismaTransactionClient — tipo del cliente dentro de $transaction.
 *
 * Con @prisma/adapter-pg, el callback de $transaction recibe un cliente
 * que en runtime tiene todos los modelos de PrismaClient ($executeRaw,
 * .cart, .order, .inventory, etc.). El tipo generado Prisma.TransactionClient
 * no los expone porque es el tipo del cliente interactivo sin adaptador.
 *
 * Usamos Omit para quitar los métodos de ciclo de vida que no están
 * disponibles dentro de una transacción ($connect, $disconnect, $transaction).
 */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
