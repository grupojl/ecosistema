/**
 * components/header.tsx — real-ecommerce-front
 *
 * Header raíz del storefront — aparece en todas las rutas via app/layout.tsx.
 *
 * Sin slug ni organizationId en este nivel (layout raíz), por eso no cargamos
 * categorías aquí. Las categorías van en /[slug]/layout.tsx.
 *
 * ADR-008 + S4-A: sin imports de @/lib/ecommerce (shim eliminado en Fase 1).
 */
'use client';

import { ShoppingBag } from 'lucide-react'
import { Button, SiteBrand, SiteHeader, ThemeToggle } from '@real/ui'
import Link from 'next/link';
import ShoppingBagModal from '@/components/shopping-bag-modal';
import { useShoppingBagStore } from '@/stores/use-shopping-bag-store';

export default function Header() {
  const { open } = useShoppingBagStore();

  return (
    <SiteHeader
      linkAs={Link}
      brand={<SiteBrand name="Tienda" href="/" linkAs={Link} />}
      actions={
        <>
          <ThemeToggle compact />
          <Button variant="ghost" size="icon" onClick={open} aria-label="Abrir bolsa" aria-haspopup="dialog">
            <ShoppingBag aria-hidden="true" />
          </Button>
          <ShoppingBagModal />
        </>
      }
    />
  );
}
