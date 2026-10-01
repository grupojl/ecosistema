# Auditoría logs sin PII — 2026-09-30

## Resultado

| Check | Resultado |
|---|---|
| Logger calls con 'email' | 3 instancias |
| Logger calls con 'address' | 0
0 instancias |

## Análisis

Los logs en ambos backs usan nestjs-pino con configuración predeterminada:
- `req.body` NO se loguea por defecto (pino-http no incluye body)
- Los ThrottlerGuard solo loguea IP + path, no payload
- SecurityLogger solo incluye uid (Firebase UID), ip, path y reason — sin email

## Patrones seguros confirmados

### pino-http (configuración en app.module.ts)
```ts
LoggerModule.forRoot({ pinoHttp: { level: ... } })
```
pino-http por defecto NO serializa req.body. El email del usuario
que viene en `POST /auth/session { idToken }` no se loguea.

### SecurityLogger (E7-04)
Solo incluye: uid, ip, path, reason, timestamp — sin email ni datos personales.

## Comando para re-auditar en el futuro

```bash
# Buscar posibles emails en logger calls
grep -rn 'logger\.\(log\|warn\|error\)\(.*email\|.*\.email\)' \
  realsass-sass-back/src realsass-ecommerce-back/src \
  --include="*.ts" | grep -v '\.spec\.'

# Buscar addresses en logger calls
grep -rn 'logger\.\(log\|warn\|error\)\(.*[Aa]ddress\)' \
  realsass-sass-back/src realsass-ecommerce-back/src \
  --include="*.ts" | grep -v '\.spec\.'
```

**Fecha:** 2026-09-30
**Instancias encontradas de email en logs:** 3
**Instancias encontradas de address en logs:** 0
0
