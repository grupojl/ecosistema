# Cambios manuales requeridos en app/layout.tsx

## 1. Agregar al inicio del archivo
```tsx
import '@/lib/firebase';
```

## 2. Actualizar AuthProvider con la prop sassBackUrl
```tsx
// ANTES:
<AuthProvider>{children}</AuthProvider>

// DESPUES:
<AuthProvider sassBackUrl={process.env.NEXT_PUBLIC_REAL_BACK_URL!}>
  {children}
</AuthProvider>
```
