/**
 * context/customer-context.tsx
 *
 * Estado del cliente del storefront.
 *
 * La credencial es una cookie HttpOnly (`store_session`) que emite el servidor en customer.identify:
 * el JavaScript del front nunca ve el token, así que un XSS no puede robarlo (ADR-004). Acá solo
 * guardamos el customerId, que es informativo (no da acceso a nada) y sirve para habilitar queries.
 *
 * ADR-005 + ADR-006: 0 fetch REST de negocio en el storefront.
 * La única excepción documentada es POST/DELETE /auth/session (cookies HttpOnly).
 */
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { createBrowserCaller } from '@/lib/trpc/browser';

// ─── Shape del contexto ────────────────────────────────────────────────────

interface CustomerContextValue {
  customerId:    string | null;
  setCustomerId: (id: string) => void;
  clearCustomer: () => void;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

// ─── Persistencia (solo el id, no es una credencial) ───────────────────────

const CUSTOMER_KEY = 'store:customerId';
// Claves de versiones anteriores (sessionId elegido por el cliente): ya no valen nada.
const LEGACY_KEYS  = ['store:sessionId'];

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* silencioso */ }
}

function clearStorage(...keys: string[]): void {
  if (typeof window === 'undefined') return;
  try { keys.forEach(k => localStorage.removeItem(k)); } catch { /* silencioso */ }
}

// ─── Provider ─────────────────────────────────────────────────────────────

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customerId, setCustomerIdState] = useState<string | null>(null);

  // Restaurar desde localStorage al montar (solo client-side)
  useEffect(() => {
    clearStorage(...LEGACY_KEYS);
    const stored = readStorage(CUSTOMER_KEY);
    if (stored) setCustomerIdState(stored);
  }, []);

  const setCustomerId = (id: string) => {
    setCustomerIdState(id);
    writeStorage(CUSTOMER_KEY, id);
  };

  const clearCustomer = () => {
    setCustomerIdState(null);
    clearStorage(CUSTOMER_KEY);
  };

  return (
    <CustomerContext.Provider value={{ customerId, setCustomerId, clearCustomer }}>
      {children}
    </CustomerContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useCustomerContext(): CustomerContextValue {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomerContext debe usarse dentro de <CustomerProvider>');
  return ctx;
}

// ─── identify / logout — tRPC publicProcedure desde el NAVEGADOR ───────────
//
// Tienen que ejecutarse en el navegador (no con el server caller de RSC): la respuesta trae un
// Set-Cookie y solo el navegador puede guardarlo. `credentials: 'include'` hace que viaje la cookie.
//
// customer.identify abre (o continúa) la sesión: devuelve el customerId y deja la cookie HttpOnly.
// Nunca devuelve una cuenta existente a partir de un email. Se llama desde los componentes de
// checkout; el customerId resultante se guarda con `setCustomerId`.

export interface IdentifyContact {
  email?:       string;
  displayName?: string;
  phone?:       string;
}

export async function identifyCustomer(
  organizationId: string,
  contact:        IdentifyContact = {},
): Promise<string> {
  const result = await createBrowserCaller(organizationId).customer.identify.mutate({ organizationId, ...contact });
  return result.customerId;
}

export async function logoutCustomer(organizationId: string): Promise<void> {
  await createBrowserCaller(organizationId).customer.logout.mutate();
}
