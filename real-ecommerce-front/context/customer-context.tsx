/**
 * context/customer-context.tsx
 *
 * Estado del cliente logueado en el storefront.
 * customerId se obtiene tras llamar al endpoint REST público:
 *   POST /ecommerce/public/:orgId/customers/identify
 *
 * Se persiste en localStorage para que el carrito sobreviva
 * a recargas de página.
 */
'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface CustomerContextValue {
  customerId:    string | null;
  sessionId:     string;
  setCustomerId: (id: string) => void;
  clearCustomer: () => void;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

const ORG_ID = process.env['NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID'] ?? '';
const API_URL = process.env['NEXT_PUBLIC_ECOMMERCE_API_URL'] ?? '';

function generateSessionId(): string {
  return crypto.randomUUID();
}

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customerId, setCustomerIdState] = useState<string | null>(null);
  const [sessionId,  setSessionId]       = useState<string>('');

  useEffect(() => {
    // Restaurar customerId y sessionId desde localStorage
    const storedCustomerId = localStorage.getItem('ecommerce_customer_id');
    const storedSessionId  = localStorage.getItem('ecommerce_session_id') ?? generateSessionId();

    if (storedCustomerId) setCustomerIdState(storedCustomerId);
    setSessionId(storedSessionId);
    localStorage.setItem('ecommerce_session_id', storedSessionId);
  }, []);

  const setCustomerId = (id: string) => {
    localStorage.setItem('ecommerce_customer_id', id);
    setCustomerIdState(id);
  };

  const clearCustomer = () => {
    localStorage.removeItem('ecommerce_customer_id');
    setCustomerIdState(null);
  };

  return (
    <CustomerContext.Provider value={{ customerId, sessionId, setCustomerId, clearCustomer }}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomerContext() {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomerContext debe usarse dentro de CustomerProvider');
  return ctx;
}

/**
 * identifyCustomer — llama al endpoint REST público para crear/recuperar
 * el cliente por email. Devuelve el customerId para guardar en context.
 * REST porque es una ruta @Public() sin auth de ningún tipo.
 */
export async function identifyCustomer(
  email: string,
  displayName?: string,
  phone?: string,
  cartId?: string,
): Promise<string> {
  const res = await fetch(
    `${API_URL}/ecommerce/public/${ORG_ID}/customers/identify`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, displayName, phone, cartId }),
    },
  );
  if (!res.ok) throw new Error('No se pudo identificar al cliente');
  const body = await res.json();
  return body?.id ?? body?.data?.id;
}
