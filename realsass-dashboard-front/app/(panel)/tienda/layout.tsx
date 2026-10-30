'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, ClipboardList, Eye, Store } from 'lucide-react';
import { PageContainer, PageHeader, SectionTabs } from '@real/ui';

const TIENDA_TABS = [
  { label: 'Productos',    href: '/tienda/productos', icon: <Package /> },
  { label: 'Pedidos',      href: '/tienda/pedidos',   icon: <ClipboardList /> },
  { label: 'Vista previa', href: '/tienda/preview',   icon: <Eye /> },
];

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <PageContainer>
      <PageHeader icon={<Store />} title="Tienda" />
      <SectionTabs
        label="Secciones de la tienda"
        items={TIENDA_TABS}
        linkAs={Link}
        isActive={(href) => pathname === href || pathname.startsWith(href)}
      />
      <div>{children}</div>
    </PageContainer>
  );
}
