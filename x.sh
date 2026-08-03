#!/usr/bin/env bash
echo "=== Fix: reemplazar todos los imports de generated/prisma ==="

node - << 'JSEOF'
const fs = require('fs');
const path = require('path');

function fixImports(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'generated') continue;
      fixImports(full);
      continue;
    }
    if (!e.name.endsWith('.ts')) continue;
    let src = fs.readFileSync(full, 'utf8');
    if (!src.includes('generated/prisma')) continue;
    const fixed = src.replace(/from ['"]\.\.\/\.\.\/generated\/prisma['"]/g, "from '@prisma/client'")
                     .replace(/from ['"]\.\/generated\/prisma['"]/g, "from '@prisma/client'")
                     .replace(/from ['"]\.\.\/generated\/prisma['"]/g, "from '@prisma/client'");
    if (fixed !== src) {
      fs.writeFileSync(full, fixed);
      console.log('✓ fixed:', full);
    }
  }
}

fixImports('realsass-sass-back/src');
fixImports('realsass-ecommerce-back/src');
console.log('done');
JSEOF

echo "✓ Listo"