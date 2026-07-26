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
	g g1 g2 g3 g4 g5 \
	git-empty git-empty1 git-empty2 git-empty3 git-empty4 git-empty5 \
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
	@echo "=== Listo — ecosistema.xml y ecosistema-infra.xml actualizados ==="

# -----------------------------------------------------------------
# X — ejecuta bash x.sh (el script activo en la raíz)
# -----------------------------------------------------------------
x:
	@[ -f x.sh ] || (echo "[✗] No existe x.sh en la raíz"; exit 1)
	@echo "=== Ejecutando x.sh ==="
	@bash x.sh

# -----------------------------------------------------------------
# GIT — timestamp automático como mensaje de commit
# -----------------------------------------------------------------
TIMESTAMP := $(shell date '+%Y-%m-%d %H:%M:%S')

# g — commit + push en TODOS con timestamp
g:
	@echo "=== Git: add + commit + push en todos los proyectos ==="
	@for dir in real-ecommerce-front realsass-dashboard-front realsass-ecommerce-back realsass-sass-back realsass-sass-front; do \
		if [ ! -d "$$dir/.git" ]; then echo "[✗] $$dir: sin .git — saltando"; continue; fi; \
		echo "[→] $$dir..."; \
		cd $$dir && git add . && \
		{ git commit -m "chore: $(TIMESTAMP)" 2>/dev/null && git push origin main && echo "[✓] $$dir: pusheado" \
		  || echo "[!] $$dir: sin cambios o ya pusheado"; }; \
		cd ..; \
	done

# g individuales
g1:
	@echo "=== Git: real-ecommerce-front ==="
	@cd real-ecommerce-front && git add . && \
	{ git commit -m "chore: $(TIMESTAMP)" 2>/dev/null && git push origin main && echo "[✓] pusheado" \
	  || echo "[!] sin cambios"; }

g2:
	@echo "=== Git: realsass-dashboard-front ==="
	@cd realsass-dashboard-front && git add . && \
	{ git commit -m "chore: $(TIMESTAMP)" 2>/dev/null && git push origin main && echo "[✓] pusheado" \
	  || echo "[!] sin cambios"; }

g3:
	@echo "=== Git: realsass-ecommerce-back ==="
	@cd realsass-ecommerce-back && git add . && \
	{ git commit -m "chore: $(TIMESTAMP)" 2>/dev/null && git push origin main && echo "[✓] pusheado" \
	  || echo "[!] sin cambios"; }

g4:
	@echo "=== Git: realsass-sass-back ==="
	@cd realsass-sass-back && git add . && \
	{ git commit -m "chore: $(TIMESTAMP)" 2>/dev/null && git push origin main && echo "[✓] pusheado" \
	  || echo "[!] sin cambios"; }

g5:
	@echo "=== Git: realsass-sass-front ==="
	@cd realsass-sass-front && git add . && \
	{ git commit -m "chore: $(TIMESTAMP)" 2>/dev/null && git push origin main && echo "[✓] pusheado" \
	  || echo "[!] sin cambios"; }

# -----------------------------------------------------------------
# GIT EMPTY — fuerza redeploy Railway
# -----------------------------------------------------------------
define _empty_commit
	@if [ ! -d "$(1)/.git" ]; then \
		echo "[✗] $(1): no tiene .git — saltando"; \
	else \
		cd $(1) && git commit --allow-empty -m "chore: redeploy $(TIMESTAMP)" && git push origin main && echo "[✓] $(1): push enviado"; \
	fi
endef

git-empty:
	@echo "=== Empty commit en todos → fuerza redeploy Railway ==="
	$(call _empty_commit,real-ecommerce-front)
	$(call _empty_commit,realsass-dashboard-front)
	$(call _empty_commit,realsass-ecommerce-back)
	$(call _empty_commit,realsass-sass-back)
	$(call _empty_commit,realsass-sass-front)

git-empty1:
	$(call _empty_commit,real-ecommerce-front)
git-empty2:
	$(call _empty_commit,realsass-dashboard-front)
git-empty3:
	$(call _empty_commit,realsass-ecommerce-back)
git-empty4:
	$(call _empty_commit,realsass-sass-back)
git-empty5:
	$(call _empty_commit,realsass-sass-front)

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
	@echo "  make g     → git add + commit timestamp + push en TODOS"
	@echo "  make g1-5  → git push en proyecto individual"
	@echo ""
	@echo "  make git-empty    → empty commit en TODOS (redeploy Railway)"
	@echo "  make git-empty1-5 → empty commit en proyecto individual"
	@echo "================================================="