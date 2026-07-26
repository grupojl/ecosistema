#!/usr/bin/env bash
# fix-packagemanager.sh
# Elimina packageManager de todos los repos (causa el Invalid Version en _linkBins)
# Agrega swagger-ui-express y joi al catalog
# Corre desde welver/

set -euo pipefail

echo "[→] Eliminando packageManager de todos los repos..."
node -e "
const fs = require('fs');
const repos = [
  'realsass-sass-back/package.json',
  'realsass-ecommerce-back/package.json',
  'realsass-sass-front/package.json',
  'realsass-dashboard-front/package.json',
  'real-ecommerce-front/package.json',
  'packages/auth-client/package.json',
  'packages/ui/package.json',
  'packages/trpc/package.json',
];
for (const r of repos) {
  try {
    const p = JSON.parse(fs.readFileSync(r, 'utf8'));
    if (p.packageManager) {
      delete p.packageManager;
      fs.writeFileSync(r, JSON.stringify(p, null, 2) + '\n');
      console.log('  ✓', r);
    } else {
      console.log('  - (sin packageManager)', r);
    }
  } catch(e) { console.log('  ! no encontrado:', r); }
}
"

echo "[→] Agregando swagger-ui-express y joi al catalog..."
sed -i 's/  "@opentelemetry\/sdk-node"/  swagger-ui-express: "^5.0.1"\n  joi: "^18.2.1"\n  "@opentelemetry\/sdk-node"/' pnpm-workspace.yaml

echo "[→] Moviendo versiones hardcodeadas al catalog en los backends..."
sed -i 's/"swagger-ui-express": "\^5\.0\.1"/"swagger-ui-express": "catalog:"/g' realsass-sass-back/package.json realsass-ecommerce-back/package.json
sed -i 's/"joi": "\^18\.2\.1"/"joi": "catalog:"/g' realsass-sass-back/package.json

echo "[→] Eliminando pnpm-lock.yaml..."
rm -f pnpm-lock.yaml

echo "[✓] Listo"
echo ""
echo "Corré: pnpm install"