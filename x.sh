#!/usr/bin/env bash
echo "=== Ejecutando x.sh ==="

node << 'JSEOF'
const fs = require('fs');

const f = 'realsass-sass-back/src/users/dto/select-role.dto.ts';
const fixed = `import { IsEnum, IsNotEmpty } from 'class-validator';

export enum UserRole {
  OWNER = 'owner',
  AFFILIATE = 'affiliate',
}

export class SelectRoleDto {
  @IsEnum(UserRole, {
    message: 'El rol debe ser "owner" o "affiliate"',
  })
  @IsNotEmpty()
  role!: UserRole;
}
`;
fs.writeFileSync(f, fixed);
console.log('fixed: select-role.dto.ts');
console.log('done');
JSEOF

echo "✓ Listo"
