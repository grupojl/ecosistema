#!/usr/bin/env bash
# =============================================================================
# x.sh — FIX 6: Restaurar UseGuards en config-secrets.controller.ts
#
# El sed anterior removia @UseGuards(TenantGuard) y @UseGuards(RolesGuard)
# pero tambien eliminaba UseGuards del import de @nestjs/common cuando
# quedaba solitario — rompiendo el uso de @UseGuards(StepUpGuard) que
# es un guard de negocio propio (step-up auth para operaciones criticas).
#
# Ademas hay otros guards propios en sass-back (ApiKeyGuard, StepUpGuard)
# que tambien necesitan UseGuards en el import.
#
# SOLUCION:
#   1. Reescribir config-secrets.controller.ts con imports correctos
#   2. Verificar otros controllers que puedan tener el mismo problema
#   3. La regla correcta de sed: solo remover @UseGuards(TenantGuard)
#      y @UseGuards(RolesGuard) del DECORADOR, nunca del import
# =============================================================================

set -euo pipefail
[ -f "pnpm-workspace.yaml" ] || { echo "Corre desde la raiz"; exit 1; }

BOLD='\033[1m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[ok]${NC} $1"; }
log() { echo -e "${BLUE}[->]${NC} $1"; }
sep() { echo -e "${BOLD}----------------------------------------------------${NC}"; }

sep
echo -e "${BOLD}  FIX 6 — Restaurar imports de UseGuards en controllers${NC}"
sep

# =============================================================================
# FIX 1 — Restaurar config-secrets.controller.ts completo
# TenantGuard y RolesGuard ahora son globales, pero StepUpGuard sigue
# siendo inline porque aplica solo a rutas especificas (step-up auth)
# =============================================================================
log "FIX 1 — Reescribiendo config-secrets.controller.ts..."

cat > realsass-sass-back/src/config-secrets/config-secrets.controller.ts << 'EOF'
import {
  Controller, Get, Post, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import type { Request }          from 'express';
import { ConfigSecretsService }  from './config-secrets.service';
import { CreateSecretDto }       from './dto/create-secret.dto';
import { Tenant }                from '@real/auth-server';
import type { TenantContext }    from '@real/auth-server';
import { Roles }                 from '@real/auth-server';
import { Public }                from '@real/auth-server';
import { StepUpGuard }           from '../common/guards/step-up.guard';
import { ApiKeyGuard }           from '../common/guards/api-key.guard';
import { IsString }              from 'class-validator';

class RotateSecretDto {
  @IsString()
  value!: string;
}

/**
 * ConfigSecretsController
 *
 * TenantGuard y RolesGuard son GLOBALES (APP_GUARD en AppModule).
 * StepUpGuard se mantiene INLINE porque solo aplica a operaciones
 * criticas (rotate y revoke) — verifica re-autenticacion reciente (5 min).
 */
@Controller('config/secrets')
@Roles('OWNER')
export class ConfigSecretsController {
  constructor(private readonly svc: ConfigSecretsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Tenant() t: TenantContext,
    @Body() dto: CreateSecretDto,
    @Req() req: Request,
  ) {
    return this.svc.create(t.organizationId, t.userId, dto, req.ip);
  }

  @Get()
  list(@Tenant() t: TenantContext) {
    return this.svc.list(t.organizationId);
  }

  @Post(':id/rotate')
  @UseGuards(StepUpGuard)
  rotate(
    @Tenant() t: TenantContext,
    @Param('id') id: string,
    @Body() dto: RotateSecretDto,
    @Req() req: Request,
  ) {
    return this.svc.rotate(t.organizationId, t.userId, id, dto.value, req.ip);
  }

  @Delete(':id')
  @UseGuards(StepUpGuard)
  revoke(
    @Tenant() t: TenantContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.svc.revoke(t.organizationId, t.userId, id, req.ip);
  }

  @Public()
  @Get('resolve/:key')
  @UseGuards(ApiKeyGuard)
  resolve(@Param('key') key: string, @Req() req: Request & { tenant: TenantContext }) {
    return this.svc.resolve(req.tenant.organizationId, key);
  }
}
EOF
ok "config-secrets.controller.ts"

# =============================================================================
# FIX 2 — Verificar otros controllers que usen UseGuards con guards propios
# (ApiKeyGuard, StepUpGuard) y asegurarnos que tengan el import correcto.
# La estrategia: buscar archivos que usen @UseGuards pero no importen UseGuards
# =============================================================================
log "FIX 2 — Verificando controllers con @UseGuards sin import de UseGuards..."

SASS_SRC="realsass-sass-back/src"

find "$SASS_SRC" -name "*.controller.ts" | while read -r f; do
  # Si el archivo usa @UseGuards pero no tiene UseGuards en el import de @nestjs/common
  if grep -q "@UseGuards" "$f" && ! grep -q "UseGuards" "$f" | grep -q "from '@nestjs/common'"; then
    # Verificar mas precisamente
    uses_guard=$(grep -c "@UseGuards" "$f" || true)
    has_import=$(grep "UseGuards" "$f" | grep -c "from '@nestjs/common'" || true)
    
    if [ "$uses_guard" -gt 0 ] && [ "$has_import" -eq 0 ]; then
      echo "[!] Falta import de UseGuards en: $f"
      # Agregar UseGuards al primer import de @nestjs/common que encontremos
      sed -i "0,/from '@nestjs\/common'/{s/^import {/import { UseGuards,/}" "$f"
    fi
  fi
done

# Verificacion alternativa mas robusta
log "Verificacion adicional por archivo..."

check_and_fix() {
  local file="$1"
  if [ ! -f "$file" ]; then return; fi
  
  local uses_useguards
  uses_useguards=$(grep -c "@UseGuards" "$file" 2>/dev/null || echo "0")
  
  if [ "$uses_useguards" -gt 0 ]; then
    local has_import
    has_import=$(grep "UseGuards" "$file" | grep -c "from '@nestjs/common'" 2>/dev/null || echo "0")
    
    if [ "$has_import" -eq 0 ]; then
      warn "Necesita UseGuards en import: $file"
      # Agregar UseGuards al import de @nestjs/common
      sed -i "/from '@nestjs\/common'/s/^import {/import { UseGuards, /" "$file"
      ok "  Agregado UseGuards a: $(basename "$file")"
    fi
  fi
}

# Revisar controllers especificos que pueden tener guards propios
check_and_fix "$SASS_SRC/config-flags/config-flags.controller.ts"
check_and_fix "$SASS_SRC/config-webhooks/config-webhooks.controller.ts"
check_and_fix "$SASS_SRC/health/health.controller.ts"
check_and_fix "$SASS_SRC/organizations/organizations.controller.ts"

# =============================================================================
# FIX 3 — Mismo proceso para ecommerce-back
# =============================================================================
log "FIX 3 — Verificando controllers de ecommerce-back..."

ECO_SRC="realsass-ecommerce-back/src"

find "$ECO_SRC" -name "*.controller.ts" | while read -r f; do
  uses_guard=$(grep -c "@UseGuards" "$f" 2>/dev/null || echo "0")
  if [ "$uses_guard" -gt 0 ]; then
    has_import=$(grep "UseGuards" "$f" | grep -c "from '@nestjs/common'" 2>/dev/null || echo "0")
    if [ "$has_import" -eq 0 ]; then
      echo "[!] Agregando UseGuards import a: $f"
      sed -i "/from '@nestjs\/common'/s/^import {/import { UseGuards, /" "$f"
    fi
  fi
done

ok "ecommerce-back controllers verificados"

# =============================================================================
# RESUMEN
# =============================================================================
sep
echo -e "${BOLD}  FIX 6 COMPLETO${NC}"
sep
echo ""
echo -e "${GREEN}  Corregido:${NC}"
echo "    [1] config-secrets.controller.ts reescrito limpio"
echo "        - TenantGuard y RolesGuard removidos (ahora son APP_GUARD global)"
echo "        - StepUpGuard mantenido inline (guard de negocio, no de infra)"
echo "        - UseGuards importado correctamente de @nestjs/common"
echo "        - Decorators importados de @real/auth-server"
echo "    [2] Controllers de ambos backs verificados por imports faltantes"
echo ""
echo -e "${GREEN}  Leccion aprendida:${NC}"
echo "    El sed 'remover @UseGuards inline' fue demasiado agresivo."
echo "    Solo debia remover @UseGuards(TenantGuard) y @UseGuards(RolesGuard)"
echo "    porque esos dos son ahora APP_GUARD globales."
echo "    Guards de negocio (StepUpGuard, ApiKeyGuard) deben mantenerse inline."
echo ""
echo "  git add . && git commit -m 'fix: restore UseGuards import, clean secrets controller' && git push"
echo ""
sep