/**
 * components/header.tsx — real-ecommerce-front
 *
 * Header raíz del storefront — aparece en todas las rutas via app/layout.tsx.
 *
 * Sin slug ni organizationId en este nivel (layout raíz), por eso no cargamos
 * categorías aquí. Las categorías van en /tienda/[slug]/layout.tsx.
 *
 * ADR-008 + S4-A: sin imports de @/lib/ecommerce (shim eliminado en Fase 1).
 */
'use client';

import Link from 'next/link';
import ShoppingBagModal from './shopping-bag-modal';
import { useShoppingBagStore } from '@/stores/use-shopping-bag-store';

export default function Header() {
  const { isOpen, open, close } = useShoppingBagStore();

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">

        <Link
          href="/"
          className="font-semibold text-sm tracking-tight hover:opacity-80 transition-opacity"
        >
          Tienda
        </Link>

        <button
          onClick={open}
          aria-label="Abrir carrito"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <line x1="3" x2="21" y1="6" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </button>
      </div>

      <ShoppingBagModal onClose={close} />
    </header>
  );
}
