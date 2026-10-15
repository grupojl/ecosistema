import type { NextFunction, Request, Response } from 'express';

/**
 * Rate limit para el middleware tRPC.
 *
 * Los guards de Nest (ThrottlerGuard) solo corren sobre controllers: `/trpc` se monta como
 * middleware de Express, así que NO estaba protegido. Este middleware cubre ese hueco.
 */
export interface RateLimitStore {
  /** Suma 1 al contador de `key` (ventana de `windowMs`) y devuelve el total actual. */
  hit(key: string, windowMs: number): Promise<number>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor() {
    // Limpieza periódica para no crecer sin límite. unref: no mantiene vivo el proceso.
    setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.buckets) if (v.resetAt <= now) this.buckets.delete(k);
    }, 60_000).unref();
  }

  hit(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return Promise.resolve(1);
    }
    current.count += 1;
    return Promise.resolve(current.count);
  }
}

export interface RateLimitRule {
  /** Procedures (ej. `customer.identify`). El patrón admite prefijo con `*`: `auth.*`. */
  procedures?: string[];
  limit: number;
  windowMs: number;
  /** Quién cuenta: por IP, por usuario autenticado (uid) o por organización. */
  by?: 'ip' | 'user' | 'org';
}

export interface RateLimitOptions {
  /** Regla por defecto para cualquier procedure sin regla propia. */
  defaultRule: RateLimitRule;
  /** Reglas más estrictas para procedures sensibles (identify, checkout, auth…). */
  rules?: RateLimitRule[];
  store?: RateLimitStore;
}

type AuthedRequest = Request & { user?: { uid?: string }; tenant?: { organizationId?: string } };

function matches(rule: RateLimitRule, procedure: string): boolean {
  return (rule.procedures ?? []).some((p) => (p.endsWith('*') ? procedure.startsWith(p.slice(0, -1)) : p === procedure));
}

function actor(req: AuthedRequest, by: RateLimitRule['by']): string {
  if (by === 'user' && req.user?.uid) return `u:${req.user.uid}`;
  if (by === 'org' && req.tenant?.organizationId) return `o:${req.tenant.organizationId}`;
  return `ip:${req.ip ?? 'unknown'}`;
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  const store = options.store ?? new MemoryRateLimitStore();
  const rules = options.rules ?? [];
  // Si el store compartido (Redis) falla, se sigue limitando con un contador LOCAL: el límite se degrada a "por
  // instancia" pero nunca queda abierto. Antes un store caído dejaba pasar todo, justo cuando más se abusa.
  const local = new MemoryRateLimitStore();
  const hit = async (key: string, windowMs: number): Promise<number> => {
    try {
      return await store.hit(key, windowMs);
    } catch {
      return local.hit(key, windowMs);
    }
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Con batch, el path es `/a.b,c.d`. Cada procedure cuenta contra su propia regla.
    const procedures = req.path.replace(/^\//, '').split(',').filter(Boolean);
    const targets = procedures.length > 0 ? procedures : ['(root)'];

    try {
      for (const procedure of targets) {
        const rule = rules.find((r) => matches(r, procedure)) ?? options.defaultRule;
        // El presupuesto es de la REGLA, no de cada procedure: 'auth.*' comparte un solo contador entre todos sus procedures
        // (un atacante no multiplica sus intentos alternando entre auth.sync, auth.refreshClaims…).
        const scope = rule === options.defaultRule ? 'default' : (rule.procedures ?? []).join('|');
        const count = await hit(`rl:${scope}:${actor(req as AuthedRequest, rule.by)}`, rule.windowMs);
        if (count > rule.limit) {
          res.setHeader('Retry-After', Math.ceil(rule.windowMs / 1000));
          res.status(429).json({ error: { message: 'Demasiadas solicitudes', code: 'TOO_MANY_REQUESTS' } });
          return;
        }
      }
    } catch {
      // Defensa en profundidad: ni siquiera el contador local debería fallar; si pasara, no se tira el servicio.
    }
    next();
  };
}
