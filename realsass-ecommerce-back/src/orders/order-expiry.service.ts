import { errorMessage } from '@/http/request';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OrdersService } from '@/orders/orders.service';

const DEFAULT_TTL_HOURS = 48;
const POLL_MS = 10 * 60_000;

/**
 * Vencimiento de órdenes sin pago (DT-ORDER-STOCK). Cancela las PENDING_PAYMENT más viejas que el plazo y libera su stock.
 * Se activa con ORDER_EXPIRY_ENABLED=true (apagado por defecto: cancela pedidos de clientes, se enciende a propósito).
 * Plazo: ORDER_PAYMENT_TTL_HOURS (48 por defecto). Seguro con varias instancias: la cancelación es un UPDATE condicional.
 */
@Injectable()
export class OrderExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderExpiryService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly orders: OrdersService) {}

  onModuleInit(): void {
    if (process.env['ORDER_EXPIRY_ENABLED'] !== 'true') return;
    this.timer = setInterval(() => void this.tick(), POLL_MS);
    this.timer.unref();
    this.logger.log(`Vencimiento de órdenes activo (plazo ${this.ttlHours()} h)`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  ttlHours(): number {
    const n = Number(process.env['ORDER_PAYMENT_TTL_HOURS']);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_HOURS;
  }

  async tick(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const cutoff = new Date(now.getTime() - this.ttlHours() * 3_600_000);
      const n = await this.orders.expireUnpaid(cutoff);
      if (n > 0) this.logger.log(`Órdenes vencidas por falta de pago: ${n}`);
      return n;
    } catch (error) {
      this.logger.error(`Fallo del vencimiento: ${errorMessage(error)}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
