#!/usr/bin/env bash
echo "=== Fix: dockerfilePath relativo a raiz del monorepo ==="

node - << 'JSEOF'
const fs = require('fs');

const services = {
  'realsass-sass-back': 'realsass-sass-back/Dockerfile',
  'realsass-ecommerce-back': 'realsass-ecommerce-back/Dockerfile',
  'realsass-sass-front': 'realsass-sass-front/Dockerfile',
  'realsass-dashboard-front': 'realsass-dashboard-front/Dockerfile',
};

for (const [svc, dockerfilePath] of Object.entries(services)) {
  const railwayJson = {
    "$schema": "https://railway.com/railway.schema.json",
    "build": {
      "builder": "DOCKERFILE",
      "dockerfilePath": dockerfilePath
    },
    "deploy": {
      "restartPolicyType": "ON_FAILURE",
      "restartPolicyMaxRetries": 3
    }
  };
  fs.writeFileSync(`${svc}/railway.json`, JSON.stringify(railwayJson, null, 2) + '\n');
  console.log(`✓ ${svc}/railway.json → dockerfilePath: ${dockerfilePath}`);
}

console.log('\n✓ Listo');
console.log('\nEn Railway UI para cada servicio:');
console.log('  Settings → Build → Builder → Dockerfile');
console.log('  Dockerfile Path → (dejar vacío, lo lee del railway.json)');
JSEOF

echo "✓ Listo"