# 13 — Norte: aplicación de escritorio (Tauri)

> 🔒 Contrato. Responde "¿cómo debería ser la app de escritorio?". Se edita solo por decisión explícita
> (ver `decisions/ADR-023-dashboard-desktop-tauri.md`). El estado actual vive en `roadmap/deuda-tecnica.md`
> (sección Desktop) y en `services/realsass-dashboard-desktop.md`.

## El norte en una línea

*Una sola app web, con una ventana nativa que no puede hacer nada que el panel no pueda. Se instala sin miedo, se actualiza sola y avisa cuando falla.*

**Referentes:** **Slack / Linear / Notion** (cascarón fino sobre la web, un solo producto) ·
**1Password / Signal** (el login y las actualizaciones son lo que más se protege) ·
**Modelo de seguridad de Tauri** (el contenido remoto no tiene poder sobre el sistema) ·
**Google SRE** (lo que no se mide, no se opera).

## Reglas no negociables

```
Alcance     la app es un cascarón: cero lógica de negocio en Rust; todo lo de negocio vive en el panel
Confianza   el panel remoto no tiene IPC; capabilities mínimas; CSP estricta; solo navega al panel
Login       navegador del sistema + loopback con PKCE o código de un solo uso; nunca un token directo
Identidad   instalador firmado (Authenticode / notarización) y logo propio; sin SmartScreen ni Gatekeeper
Updates     firmados, con confirmación del usuario, con rollback y versión mínima soportada
Calidad     nada se publica sin cargo test + cargo audit/deny + e2e del login en CI verde
Estados     toda vista define cargando, sin red, error y sin sesión (ADR-024)
Operación   crashes y versiones instaladas medidos, con consentimiento; runbook de release
Alcance+    offline y notificaciones nativas solo cuando el negocio lo pida (no antes)
```

## Los 6 pilares

### 1. Seguridad del login y de la superficie
*Principio: lo remoto nunca manda sobre lo local.*
- Login por el navegador del sistema con loopback y **PKCE o código de un solo uso**, en vez de pasar el token directo (DT-DESK-3).
- Puerto loopback efímero, `state` verificado y expiración corta.
- Capabilities mínimas y CSP estricta, auditadas y con tests. El panel remoto no tiene IPC.
- `cargo audit` y `cargo deny` en CI, alineados con ADR-018 (parte de DT-DESK-4).

### 2. Confianza de distribución
*Principio: si el sistema operativo desconfía, el usuario desconfía.*
- Firma de código en Windows (certificado OV/EV o Azure Trusted Signing) y notarización en macOS (DT-DESK-4).
- Logo propio; el actual es el de Apple y no se distribuye (DT-DESK-10).
- El instalador no dispara SmartScreen ni Gatekeeper.

### 3. Ciclo de actualización
*Principio: toda actualización debe poder deshacerse.*
- Updater firmado y activo: claves, secrets y endpoint de releases funcionando (DT-DESK-2b).
- Ciclo probado de punta a punta: publicar `desktop-vX.Y.Z`, la app detecta, pregunta e instala. Nunca en silencio.
- Rollback ante una actualización rota y versión mínima soportada (DT-DESK-11).

### 4. Calidad verificable
*Principio: sin prueba automática, no hay release.*
- Tests de la lógica Rust (`cargo test`) y de la parte web del login de escritorio (DT-DESK-6).
- e2e del flujo completo: login por navegador, regreso por loopback y deep link (DT-DESK-12).
- Workflow de release ejecutado y verde en CI (DT-DESK-8).
- Probado en cada sistema operativo que se declare soportado.

### 5. Experiencia del usuario
*Principio: una sola interfaz, adaptada al contexto (ADR-024).*
- Estados claros: sin red, panel caído, sesión expirada, error de login.
- Deep links `welver://` solo hacia rutas internas del panel.
- Modo offline (DT-DESK-5) y notificaciones nativas (DT-DESK-9) solo cuando el producto las necesite.
- Objetivos táctiles, foco visible y reduced-motion dentro de la ventana, igual que el panel.

### 6. Operación y observabilidad
*Principio: lo que no se mide, no se opera.*
- Reporte de crashes con consentimiento del usuario (DT-DESK-13).
- Métrica de versiones instaladas, para saber quién sigue en una versión vieja.
- Runbook de release y de incidente del instalador.

## Cómo se usa este norte

- **Para decidir:** si una feature le da más poder al panel remoto, se rechaza por defecto.
- **Para priorizar:** primero seguridad y confianza (pilares 1 y 2), después ciclo de actualización y calidad (3 y 4), y al final experiencia extra y operación (5 y 6).
- **Definición de 10/10:** se cumplen todas las reglas de arriba y un CI las verifica; no basta con que estén documentadas.

## Relación con otros contratos

| Documento | Qué aporta |
|---|---|
| `decisions/ADR-023-dashboard-desktop-tauri.md` | La decisión de usar Tauri v2 con la opción A (cascarón sobre el dashboard desplegado) |
| `architecture/12-ui-norte.md` | Reglas de UI que la app hereda del panel |
| `architecture/11-dependencias-norte.md` | Política de dependencias; aplica a las crates de Rust (`cargo deny`) |
| `architecture/08-testing-norte.md` | Estrategia de pruebas general |
| `architecture/09-observabilidad-norte.md` | Observabilidad general; el pilar 6 la extiende al cliente |
