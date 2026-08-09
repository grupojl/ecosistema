#!/usr/bin/env bash
# =============================================================================
# x.sh — FIX 8: ApiKeyGuard compatible con schema actual de sass-back
#
# El schema actual de sass-back NO tiene modelo ApiKey ni enum MembershipRole.
# Tiene: User, Organization, Collaborator, Invitation, AffiliateData + config models.
#
# El ApiKeyGuard del fix anterior usaba prisma.apiKey y MembershipRole
# que solo existen en el schema del config-back viejo (no fusionado).
#
# SOLUCION: ApiKeyGuard simplificado que valida contra INTERNAL_API_KEY
# en variables de entorno. Es la implementacion correcta para esta etapa
# donde las rutas internas (/config/secrets/resolve, /config/flags/:orgId)
# son consumidas por servicios internos con una clave compartida.
# =============================================================================

set -euo pipefail
[ -f "pnpm-workspace.yaml" ] || { echo "Corre desde la raiz"; exit 1; }

BOLD='\033[1m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[ok]${NC} $1"; }
log() { echo -e "${BLUE}[->]${NC} $1"; }
sep() { echo -e "${BOLD}----------------------------------------------------${NC}"; }

sep
echo -e "${BOLD}  FIX 8 — ApiKeyGuard compatible con schema actual${NC}"
sep

log "Reescribiendo api-key.guard.ts sin dependencia de prisma.apiKey..."

cat > realsass-sass-back/src/common/guards/api-key.guard.ts << 'EOF'
import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';

/**
 * ApiKeyGuard — valida el header x-api-key contra INTERNAL_API_KEY.
 *
 * Usado en rutas internas de config que consumen servicios del ecosistema:
 *   GET /config/secrets/resolve/:key  (ecommerce-back, chat-back, etc.)
 *   GET /config/flags/:orgId          (servicios externos)
 *   GET /config/templates/:key        (servicios externos)
 *
 * Configuracion requerida en .env:
 *   INTERNAL_API_KEY=tu-clave-secreta-interna
 *
 * Esta implementacion es correcta para la etapa actual donde los consumidores
 * son servicios internos del ecosistema. Cuando se necesiten API Keys por
 * organizacion (modelo ApiKey en schema), se puede reemplazar esta implementacion
 * sin cambiar los controllers que la usan.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req    = ctx.switchToHttp().getRequest();
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      throw new UnauthorizedException('Header x-api-key requerido');
    }

    const validKey = process.env['INTERNAL_API_KEY'];

    if (!validKey) {
      throw new UnauthorizedException('INTERNAL_API_KEY no configurada en el servidor');
    }

    if (apiKey !== validKey) {
      throw new UnauthorizedException('API Key invalida');
    }

    return true;
  }
}
EOF
ok "api-key.guard.ts reescrito"

sep
echo -e "${BOLD}  FIX 8 COMPLETO${NC}"
sep
echo ""
echo -e "${GREEN}  Que se hizo:${NC}"
echo "    ApiKeyGuard reescrito sin prisma.apiKey ni MembershipRole"
echo "    Valida x-api-key contra variable de entorno INTERNAL_API_KEY"
echo "    Compatible con el schema actual de sass-back"
echo ""
echo -e "${GREEN}  Agregar en Railway (sass-back variables de entorno):${NC}"
echo "    INTERNAL_API_KEY=<generar con: openssl rand -hex 32>"
echo ""
echo -e "${GREEN}  Y en los servicios que consumen esas rutas:${NC}"
echo "    INTERNAL_API_KEY=<mismo valor>"
echo ""
echo "  git add . && git commit -m 'fix: simplify ApiKeyGuard, no prisma.apiKey dependency' && git push"
echo ""
sep