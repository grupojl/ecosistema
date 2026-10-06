# Domain — Ecosistema SaaS Ecommerce

## Qué es esta carpeta

La fuente de verdad de **qué es el producto, cómo se ve y cómo se comporta**.
No es documentación técnica — es el contrato de producto y marca.

Antes de implementar cualquier feature nueva, pantalla nueva o componente nuevo,
se lee el archivo relevante de esta carpeta. El código implementa lo que dice
el dominio. Si hay contradicción entre el código y este archivo, el dominio gana.

## Estructura

```
.claude/domain/
  README.md                    ← índice y reglas
  vision.md                    ← qué es el producto, a quién va, qué problema resuelve
  brand.md                     ← nombre, personalidad, tono de comunicación
  ui.md                        ← sistema de diseño: colores, tipografía, tokens
  flows/
    README.md                  ← cómo leer los flujos
    saas-onboarding.md         ← registro → organización activa
    tenant-store.md            ← configuración de tienda → storefront live
    storefront-buy.md          ← visitante → compra completada
    dashboard-ops.md           ← operación diaria del tenant
    superadmin.md              ← flujos internos de administración
```

## Estado de archivos

| Archivo | Contenido | Estado |
|---------|-----------|--------|
| `vision.md` | Propósito, usuarios, mercado | 🔲 Por completar |
| `brand.md` | Nombre, personalidad, tono | 🔲 Por completar |
| `ui.md` | Tokens de diseño, fuentes, colores | 🔲 Por completar |
| `flows/saas-onboarding.md` | Registro hasta org activa | 🔲 Por completar |
| `flows/tenant-store.md` | Config tienda → live | 🔲 Por completar |
| `flows/storefront-buy.md` | Visitante → compra | 🔲 Por completar |
| `flows/dashboard-ops.md` | Operación diaria dashboard | 🔲 Por completar |
| `flows/superadmin.md` | Flujos internos | 🔲 Por completar |

## Regla de mantenimiento

- Cambio en identidad visual → actualizar `ui.md`
- Cambio en nombre o tono → actualizar `brand.md`
- Cambio en flujo de usuario → actualizar el flow correspondiente
- Cambio en propuesta de valor → actualizar `vision.md`

Sin actualización de dominio → el PR no se aprueba.
