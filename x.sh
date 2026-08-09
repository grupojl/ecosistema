#!/usr/bin/env bash
# =============================================================================
# x.sh — FIX 4: Cannot find module 'run-script-webpack-plugin'
#
# CAUSA: el webpack.config.js anterior usaba run-script-webpack-plugin
# que es solo para desarrollo con HMR. No esta instalado en el build
# de produccion de Railway.
#
# SOLUCION: webpack.config.js minimo — solo el allowlist para @real/*
# Sin plugins de dev que no existen en el contexto de build.
# =============================================================================

set -euo pipefail
[ -f "pnpm-workspace.yaml" ] || { echo "Corre desde la raiz"; exit 1; }

BOLD='\033[1m'; GREEN='\033[0;32m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[ok]${NC} $1"; }
sep() { echo -e "${BOLD}----------------------------------------------------${NC}"; }

sep
echo -e "${BOLD}  FIX 4 — webpack.config.js sin run-script-webpack-plugin${NC}"
sep

# webpack.config.js minimo para sass-back
cat > realsass-sass-back/webpack.config.js << 'EOF'
const nodeExternals = require('webpack-node-externals');

module.exports = function (options) {
  return {
    ...options,
    externals: [
      nodeExternals({
        // Incluir paquetes @real/* en el bundle.
        // Sin esto Node.js no puede resolver @real/auth-server en runtime
        // porque el symlink del workspace no existe en la imagen Docker.
        allowlist: [/@real\//],
      }),
    ],
  };
};
EOF
ok "sass-back/webpack.config.js"

# webpack.config.js minimo para ecommerce-back
cat > realsass-ecommerce-back/webpack.config.js << 'EOF'
const nodeExternals = require('webpack-node-externals');

module.exports = function (options) {
  return {
    ...options,
    externals: [
      nodeExternals({
        allowlist: [/@real\//],
      }),
    ],
  };
};
EOF
ok "ecommerce-back/webpack.config.js"

sep
echo -e "${BOLD}  FIX 4 COMPLETO${NC}"
sep
echo ""
echo "  git add . && git commit -m 'fix: simplify webpack config, remove dev plugins' && git push"
echo ""
sep