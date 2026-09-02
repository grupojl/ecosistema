/**
 * context/customer-context.tsx
 *
 * Estado del cliente logueado en el storefront.
 * customerId se obtiene llamando a customer.identify (tRPC publicProcedure).
 * Se persiste en localStorage para que el carrito sobreviva a recargas.
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
import { createStoreCaller } from '@/lib/trpc/server';

// ─── Shape del contexto ────────────────────────────────────────────────────

interface CustomerContextValue {
  customerId:    string | null;
  sessionId:     string;
  setCustomerId: (id: string) => void;
  clearCustomer: () => void;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

// ─── Helpers de persistencia ───────────────────────────────────────────────

const CUSTOMER_KEY = 'store:customerId';
const SESSION_KEY  = 'store:sessionId';

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

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
  const [sessionId,  setSessionIdState]  = useState<string>('');

  // Restaurar desde localStorage al montar (solo client-side)
  useEffect(() => {
    const storedCustomerId = readStorage(CUSTOMER_KEY);
    const storedSessionId  = readStorage(SESSION_KEY) ?? generateSessionId();

    if (storedCustomerId) setCustomerIdState(storedCustomerId);

    if (!readStorage(SESSION_KEY)) writeStorage(SESSION_KEY, storedSessionId);
    setSessionIdState(storedSessionId);
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
    <CustomerContext.Provider value={{ customerId, sessionId, setCustomerId, clearCustomer }}>
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

// ─── identifyCustomer — tRPC publicProcedure ───────────────────────────────
//
// Reemplaza el fetch REST a POST /ecommerce/public/:orgId/customers/identify
// El procedure customer.identify es @Public() en ecommerce-back —
// no requiere Firebase ni customerId previo.
//
// Se llama desde componentes de checkout al capturar el email del cliente.
// El customerId resultante se persiste en CustomerContext (localStorage).

export async function identifyCustomer(
  organizationId: string,
  email:          string,
  displayName?:   string,
  phone?:         string,
  cartId?:        string,
): Promise<string> {
  const caller = createStoreCaller(organizationId);

  const result = await caller.customer.identify({
    organizationId,
    email,
    displayName,
    phone,
    cartId: cartId ?? undefined,
  });

  return result.customerId;
}
