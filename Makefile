# =================================================================
# MAKEFILE — CONTROL DE ECOSISTEMA (WELVER)
# =================================================================

ifneq (,$(wildcard .env.make))
  include .env.make
  export $(shell grep -v '^\#' .env.make | grep -v '^\s*$$' | cut -d= -f1)
endif

.PHONY: \
	1 2 3 4 5 \
	r \
	x \
	g \
	git-empty \
	dev install help

# -----------------------------------------------------------------
# PROYECTOS — cd al directorio y levanta
# -----------------------------------------------------------------
1:
	@echo "=== real-ecommerce-front (:$(PORT_ECOMMERCE_FRONT)) ==="
	@cd real-ecommerce-front && pnpm run dev

2:
	@echo "=== realsass-dashboard-front (:$(PORT_DASHBOARD_FRONT)) ==="
	@cd realsass-dashboard-front && pnpm run dev

3:
	@echo "=== realsass-ecommerce-back (:$(PORT_ECOMMERCE_BACK)) ==="
	@cd realsass-ecommerce-back && pnpm run start:dev

4:
	@echo "=== realsass-sass-back (:$(PORT_SASS_BACK)) ==="
	@cd realsass-sass-back && pnpm run start:dev

5:
	@echo "=== realsass-sass-front (:$(PORT_SASS_FRONT)) ==="
	@cd realsass-sass-front && pnpm run dev

# -----------------------------------------------------------------
# DEV — ecosistema completo
# -----------------------------------------------------------------
dev:
	@bash sh/dev.sh \
		"realsass-ecommerce-back:back:$(PORT_ECOMMERCE_BACK)" \
		"realsass-sass-back:back:$(PORT_SASS_BACK)" \
		"real-ecommerce-front:front:$(PORT_ECOMMERCE_FRONT)" \
		"realsass-dashboard-front:front:$(PORT_DASHBOARD_FRONT)" \
		"realsass-sass-front:front:$(PORT_SASS_FRONT)"

# -----------------------------------------------------------------
# INSTALL
# -----------------------------------------------------------------
install:
	@echo "=== pnpm install --ignore-scripts (workspace) ==="
	pnpm install --ignore-scripts

# -----------------------------------------------------------------
# REPOMIX — genera ecosistema.xml y ecosistema-infra.xml
# -----------------------------------------------------------------
r:
	@echo "=== Generando ecosistema.xml... ==="
	@npx repomix --config repomix.config.json
	@echo "=== Generando ecosistema-infra.xml... ==="
	@npx repomix --config repomix.infra.config.json
	@echo "=== Listo ==="

# -----------------------------------------------------------------
# X — ejecuta bash x.sh (el script activo en la raíz)
# -----------------------------------------------------------------
x:
	@[ -f x.sh ] || (echo "[✗] No existe x.sh en la raíz"; exit 1)
	@echo "=== Ejecutando x.sh ==="
	@bash x.sh

# -----------------------------------------------------------------
# GIT — monorepo: un solo repo en la raíz
# -----------------------------------------------------------------
TIMESTAMP := $(shell date '+%Y-%m-%d %H:%M:%S')

g:
	@echo "=== Git: add + commit + push (monorepo raíz) ==="
	@git add .
	@git commit -m "chore: $(TIMESTAMP)" 2>/dev/null && \
		git push origin main && \
		echo "[✓] pusheado" || \
		echo "[!] sin cambios"

# -----------------------------------------------------------------
# GIT EMPTY — fuerza redeploy Railway
# -----------------------------------------------------------------
git-empty:
	@echo "=== Empty commit → fuerza redeploy Railway ==="
	@git commit --allow-empty -m "chore: redeploy $(TIMESTAMP)"
	@git push origin main
	@echo "[✓] Redeploy disparado"

# -----------------------------------------------------------------
# HELP
# -----------------------------------------------------------------
help:
	@echo "================================================="
	@echo "  ECOSISTEMA WELVER — comandos disponibles"
	@echo "================================================="
	@echo ""
	@echo "  make 1     → real-ecommerce-front     :$(PORT_ECOMMERCE_FRONT)"
	@echo "  make 2     → realsass-dashboard-front :$(PORT_DASHBOARD_FRONT)"
	@echo "  make 3     → realsass-ecommerce-back  :$(PORT_ECOMMERCE_BACK)"
	@echo "  make 4     → realsass-sass-back       :$(PORT_SASS_BACK)"
	@echo "  make 5     → realsass-sass-front      :$(PORT_SASS_FRONT)"
	@echo ""
	@echo "  make dev   → ecosistema completo"
	@echo "  make install → pnpm install --ignore-scripts"
	@echo ""
	@echo "  make r     → genera ecosistema.xml + ecosistema-infra.xml"
	@echo "  make x     → ejecuta x.sh (script activo en la raíz)"
	@echo ""
	@echo "  make g     → git add + commit timestamp + push (monorepo)"
	@echo "  make git-empty → empty commit (fuerza redeploy Railway)"
	@echo "================================================="