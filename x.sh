#!/usr/bin/env bash
echo "=== Ejecutando x.sh ==="

node << 'JSEOF'
const fs = require('fs');

const files = [
  'realsass-sass-back/src/common/decorators/current-user.decorator.ts',
  'realsass-sass-back/src/common/guards/tenant.guard.ts',
  'realsass-sass-back/src/config-secrets/crypto.service.ts',
  'realsass-sass-back/src/trpc/trpc.ts',
  'realsass-sass-back/src/trpc/app-router.ts',
  'realsass-sass-back/src/users/types/organization-access.types.ts',
];

for (const f of files) {
  let src = fs.readFileSync(f, 'utf8');
  const fixed = src.replace(/^( +)([a-zA-Z][a-zA-Z0-9]*)!:/gm, '$1$2:');
  if (fixed !== src) {
    fs.writeFileSync(f, fixed);
    console.log('fixed:', f);
  }
}
console.log('done');
JSEOF

echo "✓ Listo"
