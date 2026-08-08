#!/usr/bin/env bash
# =============================================================================
# x.sh — FIX 3: Cannot find module '@real/auth-server' en runtime
#
# CAUSA RAIZ:
#   NestJS build usa webpack con webpack-node-externals, que excluye todos los
#   node_modules del bundle — incluyendo los paquetes workspace (@real/*).
#   El dist/ queda con require('@real/auth-server') sin resolver y falla al
#   arrancar el container en Railway.
#
# SOLUCION:
#   Configurar nest-cli.json en cada back para que webpack INCLUYA los paquetes
#   @real/* en el bundle (allowlist en webpack-node-externals).
#   Ademas agregar @nestjs/config como dependencia real en ecommerce-back.
#
# Corre desde la raiz del monorepo.
# =============================================================================

set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'
log() { echo -e "${BLUE}[->]${NC} $1"; }
ok()  { echo -e "${GREEN}[ok]${NC} $1"; }
sep() { echo -e "${BOLD}----------------------------------------------------${NC}"; }

[ -f "pnpm-workspace.yaml" ] || { echo "Corre desde la raiz"; exit 1; }

sep
echo -e "${BOLD}  FIX 3 — Bundle @real/* en el dist de NestJS${NC}"
sep

# =============================================================================
# FIX 1 — webpack.config.js en sass-back
# Configura webpack para que incluya @real/* en el bundle en lugar de
# dejarlos como require() externos que Node.js no puede resolver.
# =============================================================================
log "FIX 1 — webpack.config.js en sass-back..."

cat > realsass-sass-back/webpack.config.js << 'EOF'
const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

module.exports = function (options, webpack) {
  return {
    ...options,
    entry: ['webpack/hot/poll?100', options.entry],
    externals: [
      nodeExternals({
        // Incluir paquetes @real/* en el bundle en lugar de dejarlos externos.
        // Sin esto, Node.js intenta resolver @real/auth-server desde node_modules
        // en runtime y falla porque el symlink del workspace no existe en la imagen.
        allowlist: [/@real\//],
      }),
    ],
    plugins: [
      ...options.plugins,
      new webpack.HotModuleReplacementPlugin(),
      new webpack.WatchIgnorePlugin({
        paths: [/\.js$/, /\.d\.ts$/],
      }),
      new RunScriptWebpackPlugin({
        name: options.output.filename,
        autoRestart: false,
      }),
    ],
  };
};
EOF
ok "sass-back/webpack.config.js"

# =============================================================================
# FIX 2 — nest-cli.json en sass-back
# Apunta al webpack.config.js personalizado.
# =============================================================================
log "FIX 2 — nest-cli.json en sass-back..."

cat > realsass-sass-back/nest-cli.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "webpack": true,
    "webpackConfigPath": "webpack.config.js"
  }
}
EOF
ok "sass-back/nest-cli.json"

# =============================================================================
# FIX 3 — webpack.config.js en ecommerce-back (mismo patron)
# =============================================================================
log "FIX 3 — webpack.config.js en ecommerce-back..."

cat > realsass-ecommerce-back/webpack.config.js << 'EOF'
const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

module.exports = function (options, webpack) {
  return {
    ...options,
    entry: ['webpack/hot/poll?100', options.entry],
    externals: [
      nodeExternals({
        allowlist: [/@real\//],
      }),
    ],
    plugins: [
      ...options.plugins,
      new webpack.HotModuleReplacementPlugin(),
      new webpack.WatchIgnorePlugin({
        paths: [/\.js$/, /\.d\.ts$/],
      }),
      new RunScriptWebpackPlugin({
        name: options.output.filename,
        autoRestart: false,
      }),
    ],
  };
};
EOF
ok "ecommerce-back/webpack.config.js"

# =============================================================================
# FIX 4 — nest-cli.json en ecommerce-back
# =============================================================================
log "FIX 4 — nest-cli.json en ecommerce-back..."

cat > realsass-ecommerce-back/nest-cli.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "webpack": true,
    "webpackConfigPath": "webpack.config.js"
  }
}
EOF
ok "ecommerce-back/nest-cli.json"

# =============================================================================
# FIX 5 — ecommerce-back: agregar @nestjs/config como dependencia real
# El app.module.ts lo importa — necesita estar en dependencies, no solo
# disponible via shamefully-hoist.
# =============================================================================
log "FIX 5 — agregando @nestjs/config a ecommerce-back..."

node -e "
const fs  = require('fs');
const p   = 'realsass-ecommerce-back/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies['@nestjs/config'] = 'catalog:';
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
console.log('[ok] @nestjs/config agregado a ecommerce-back');
"

# =============================================================================
# FIX 6 — sass-back: agregar @real/auth-server a dependencies si falta
# =============================================================================
log "FIX 6 — verificando @real/auth-server en sass-back package.json..."

node -e "
const fs  = require('fs');
const p   = 'realsass-sass-back/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
if (!pkg.dependencies['@real/auth-server']) {
  pkg.dependencies['@real/auth-server'] = 'workspace:*';
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[ok] @real/auth-server agregado a sass-back');
} else {
  console.log('[ok] @real/auth-server ya estaba en sass-back');
}
"

# =============================================================================
# FIX 7 — ecommerce-back: agregar @real/auth-server a dependencies si falta
# =============================================================================
log "FIX 7 — verificando @real/auth-server en ecommerce-back package.json..."

node -e "
const fs  = require('fs');
const p   = 'realsass-ecommerce-back/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
if (!pkg.dependencies['@real/auth-server']) {
  pkg.dependencies['@real/auth-server'] = 'workspace:*';
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[ok] @real/auth-server agregado a ecommerce-back');
} else {
  console.log('[ok] @real/auth-server ya estaba en ecommerce-back');
}
"

# =============================================================================
# FIX 8 — pnpm install para actualizar lockfile con los cambios de package.json
# =============================================================================
sep
log "FIX 8 — pnpm install..."
pnpm install --ignore-scripts
ok "pnpm install completado"

# =============================================================================
# RESUMEN
# =============================================================================
sep
echo -e "${BOLD}  FIX 3 COMPLETO${NC}"
sep
echo ""
echo -e "${GREEN}  Que se hizo:${NC}"
echo "    webpack.config.js en ambos backs con allowlist: [/@real\//]"
echo "    nest-cli.json en ambos backs apuntando al webpack.config.js"
echo "    @nestjs/config agregado como dependencia real en ecommerce-back"
echo "    @real/auth-server verificado en package.json de ambos backs"
echo ""
echo -e "${GREEN}  Por que funciona:${NC}"
echo "    webpack-node-externals excluia @real/* del bundle (tratandolos"
echo "    como modulos externos). Con allowlist le decimos que los INCLUYA"
echo "    en el bundle. El dist/ queda con el codigo de @real/auth-server"
echo "    compilado adentro — no hay require() externo que resolver."
echo ""
echo -e "${GREEN}  Proximo paso:${NC}"
echo "    git add . && git commit -m 'fix: bundle @real packages in webpack' && git push"
echo ""
sep