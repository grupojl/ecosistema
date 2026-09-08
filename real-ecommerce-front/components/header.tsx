/**
 * components/header.tsx — real-ecommerce-front
 *
 * ADR-012: Eliminada dependencia de @/lib/ecommerce (eliminada en ADR-008).
 * Header estático hasta que exista customer.getCategories en EcommerceAppRouter.
 *
 * Las categorías por tienda se renderizan en los layouts de /tienda/[slug]/
 * como Server Components — no necesitan este header genérico.
 */
'use client';

import { useState }             from 'react';
import Link                     from 'next/link';
import { ShoppingBagModal }     from './shopping-bag-modal';
import { useShoppingBagStore }  from '@/stores/use-shopping-bag-store';

export function Header() {
  const [bagOpen, setBagOpen] = useState(false);
  const itemCount = useShoppingBagStore((s) => s.items.length);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Tienda
          </Link>

          <button
            onClick={() => setBagOpen(true)}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
            aria-label={`Carrito${itemCount > 0 ? ` (${itemCount})` : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </button>
        </div>
      </header>
      <ShoppingBagModal open={bagOpen} onOpenChange={setBagOpen} />
    </>
  );
}
