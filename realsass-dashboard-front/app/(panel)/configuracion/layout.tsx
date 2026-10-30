'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Palette, ToggleLeft, Webhook, ChartColumnBig, Settings2 } from 'lucide-react';
import { PageContainer, PageHeader, SectionTabs } from '@real/ui';

const CONFIG_TABS = [
  { label: 'Tema visual',   href: '/configuracion/tema',     icon: <Palette /> },
  { label: 'Feature Flags', href: '/configuracion/flags',    icon: <ToggleLeft /> },
  { label: 'Webhooks',      href: '/configuracion/webhooks', icon: <Webhook /> },
  { label: 'Quotas',        href: '/configuracion/quotas',   icon: <ChartColumnBig /> },
];

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <PageContainer size="md">
      <PageHeader icon={<Settings2 />} title="Configuración" />
      <SectionTabs label="Secciones de configuración" items={CONFIG_TABS} linkAs={Link} isActive={(href) => pathname === href} />
      <div>{children}</div>
    </PageContainer>
  );
}
