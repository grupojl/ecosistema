# ══════════════════════════════════════════════════════
# AUDIT B · CONTRATOS / TIPADO — greps completos
# Válido para ecosistema-ms, ecosistema y superadmin
# Correr desde el root del repo
# ══════════════════════════════════════════════════════

# B1 · as any sin anotación
find . \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" -not -path "*/.next/*" \
  -not -path "*/dist/*" -not -path "*/build/*" \
  -print0 | xargs -0 grep -n " as any" \
  | grep -v "node_modules"

# B1b · parámetros tipados como any (ADR-007)
find . \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" -not -path "*/dist/*" \
  -print0 | xargs -0 grep -n ": any\b\|: any," \
  | grep -v "node_modules"

# B2 · as unknown as sin anotación
find . \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" -not -path "*/dist/*" \
  -print0 | xargs -0 grep -n " as unknown as" \
  | grep -v "node_modules"

# B3 · @ts-ignore (prohibido sin excepción)
find . \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" \
  -print0 | xargs -0 grep -n "@ts-ignore"

# B4 · @ts-expect-error sin texto explicativo
find . \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" \
  -print0 | xargs -0 grep -n "@ts-expect-error" \
  | grep -v "node_modules"

# B5 · class-validator (prohibido — usar Zod)
find . \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" \
  -print0 | xargs -0 grep -n \
  "from 'class-validator'\|from \"class-validator\"\|class-validator\b\|@IsString\b\|@IsEmail\b\|@IsEnum\b\|@IsOptional\b\|@IsNotEmpty\b"

# B6 · strictNullChecks activo en tsconfig
grep -E "strictNullChecks|\"strict\"" tsconfig.base.json 2>/dev/null \
  || echo "FALTA tsconfig.base.json o strictNullChecks"



B1 as any → ✅
B2 as unknown as → ❌ falta
B3 @ts-ignore → ✅
B4 @ts-expect-error sin texto → ✅
B5 class-validator → ❌ falta