#!/usr/bin/env bash
# =============================================================================
# x.sh — FIX 7: Recrear guards de negocio borrados en sass-back
#
# api-key.guard.ts y step-up.guard.ts fueron borrados por el x.sh de
# limpieza inicial (borraba todo src/common/guards/).
# Son guards de NEGOCIO propios de sass-back, no de infra — deben vivir
# en src/common/guards/ del servicio, no en @real/auth-server.
# =============================================================================

set -euo pipefail
[ -f "pnpm-workspace.yaml" ] || { echo "Corre desde la raiz"; exit 1; }

BOLD='\033[1m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[ok]${NC} $1"; }
log() { echo -e "${BLUE}[->]${NC} $1"; }
sep() { echo -e "${BOLD}----------------------------------------------------${NC}"; }

sep
echo -e "${BOLD}  FIX 7 — Recrear guards de negocio en sass-back${NC}"
sep

mkdir -p realsass-sass-back/src/common/guards

# =============================================================================
# api-key.guard.ts — verifica API Keys de sistema (x-api-key header)
# Usada en rutas internas de config: /config/secrets/resolve, /config/flags/:orgId
# =============================================================================
log "Recreando api-key.guard.ts..."

cat > realsass-sass-back/src/common/guards/api-key.guard.ts << 'EOF'
import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { PrismaService }   from '../../prisma/prisma.service';
import { MembershipRole }  from '@prisma/client';
import * as bcrypt         from 'bcryptjs';

const KEY_PREFIX = 'sk_live_';

/**
 * ApiKeyGuard — autentica via header x-api-key.
 * Usada en rutas de sistema que consumen config en runtime:
 *   GET /config/secrets/resolve/:key
 *   GET /config/flags/:orgId
 *   GET /config/templates/:key
 *
 * NO es un APP_GUARD global — se aplica inline con @UseGuards(ApiKeyGuard)
 * solo en las rutas que lo necesitan.
 *
 * Inyecta req.tenant con el organizationId de la API Key para que
 * los services puedan usarlo normalmente.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req    = ctx.switchToHttp().getRequest();
    const rawKey = req.headers['x-api-key'] as string | undefined;

    if (!rawKey) return false;
    if (!rawKey.startsWith(KEY_PREFIX)) {
      throw new UnauthorizedException('Formato de API Key invalido');
    }

    const keyPrefix  = rawKey.substring(0, 12);
    const candidates = await this.prisma.apiKey.findMany({
      where: {
        keyPrefix,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { organization: true },
    });

    for (const candidate of candidates) {
      const valid = await bcrypt.compare(rawKey, candidate.keyHash);
      if (valid) {
        // Actualizar lastUsedAt sin bloquear el request
        void this.prisma.apiKey
          .update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } })
          .catch(() => null);

        req.tenant = {
          organizationId:     candidate.organizationId,
          role:               MembershipRole.MEMBER,
          apiKeyScopes:       candidate.scopes as string[],
          productPermissions: {},
        };
        return true;
      }
    }

    throw new UnauthorizedException('API Key invalida o expirada');
  }
}
EOF
ok "api-key.guard.ts"

# =============================================================================
# step-up.guard.ts — verifica re-autenticacion reciente (ventana de 5 min)
# Usada en operaciones criticas: rotate y revoke de secretos
# =============================================================================
log "Recreando step-up.guard.ts..."

cat > realsass-sass-back/src/common/guards/step-up.guard.ts << 'EOF'
import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable,
} from '@nestjs/common';
import * as admin from 'firebase-admin';

/**
 * StepUpGuard — exige re-autenticacion reciente (maximo 5 minutos).
 * Se usa en operaciones criticas que requieren que el usuario haya
 * ingresado su password recientemente:
 *   POST /config/secrets/:id/rotate
 *   DELETE /config/secrets/:id
 *
 * NO es un APP_GUARD global — se aplica inline con @UseGuards(StepUpGuard).
 * Funciona verificando auth_time del Firebase idToken.
 */
@Injectable()
export class StepUpGuard implements CanActivate {
  private readonly WINDOW_MS = 5 * 60 * 1_000; // 5 minutos

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req   = ctx.switchToHttp().getRequest();
    const token = (req.headers['authorization'] as string | undefined)?.split(' ')[1];

    if (!token) throw new ForbiddenException('Token requerido para esta accion');

    const decoded  = await admin.app().auth().verifyIdToken(token);
    const authTime = decoded.auth_time * 1_000;

    if (Date.now() - authTime > this.WINDOW_MS) {
      throw new ForbiddenException(
        'Re-autenticacion requerida. Cerrá sesion y volvé a ingresar.',
      );
    }

    return true;
  }
}
EOF
ok "step-up.guard.ts"

# =============================================================================
# Verificar si hay otros controllers que importan guards de ../common/guards/
# que pudieran haberse borrado — listar para revision manual
# =============================================================================
sep
log "Verificando imports de guards en controllers de sass-back..."

echo ""
echo "  Controllers que importan guards locales:"
grep -rl "from '../common/guards/" realsass-sass-back/src/ 2>/dev/null \
  | grep "\.controller\." \
  | sed 's|realsass-sass-back/src/||' \
  | while read -r f; do echo "    - $f"; done

echo ""
echo "  Guards que existen ahora en src/common/guards/:"
ls realsass-sass-back/src/common/guards/ 2>/dev/null \
  | while read -r f; do echo "    - $f"; done

# =============================================================================
# RESUMEN
# =============================================================================
sep
echo -e "${BOLD}  FIX 7 COMPLETO${NC}"
sep
echo ""
echo -e "${GREEN}  Recreado:${NC}"
echo "    src/common/guards/api-key.guard.ts  — auth via x-api-key header"
echo "    src/common/guards/step-up.guard.ts  — re-auth en ventana de 5 min"
echo ""
echo -e "${GREEN}  Estos guards son de NEGOCIO — viven en sass-back, no en @real/auth-server${NC}"
echo "    ApiKeyGuard  — necesita PrismaService (acceso a DB de sass-back)"
echo "    StepUpGuard  — necesita firebase-admin (ya disponible via FirebaseModule)"
echo ""
echo "  git add . && git commit -m 'fix: recreate business guards api-key and step-up' && git push"
echo ""
sep