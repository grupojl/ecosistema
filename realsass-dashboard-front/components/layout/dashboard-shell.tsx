'use client';

/**
 * Armazón del panel: navegación adaptable de Welver (barra inferior en compact, riel en medium, barra lateral en
 * expanded). Los destinos salen de `config/navigation.ts`; la forma la pone `AppShell` de @real/ui.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Package, ShoppingBag, ExternalLink,
  MessageSquare, CreditCard, TrendingUp,
  Palette, ToggleLeft, Webhook, ChartColumnBig,
  LogOut, MonitorSmartphone, LifeBuoy, EllipsisVertical,
} from 'lucide-react';
import {
  AppShell, Avatar, AvatarFallback, Button, ThemeToggle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  type AccountVariant, type NavGroup,
} from '@real/ui';
import { ConnectedDevicesDialog } from '@/components/devices-dialog-connected';
import { ConnectedFeedbackDialog } from '@/components/feedback-dialog-connected';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useActiveOrganization } from '@/features/auth/hooks/use-active-organization';
import { siteConfig } from '@/config/site';
import { NAV_GROUPS } from '@/config/navigation';

const ICONS: Record<string, React.ElementType> = {
  Package, ShoppingBag, ExternalLink,
  MessageSquare, CreditCard, TrendingUp,
  Palette, ToggleLeft, Webhook, ChartColumnBig,
};

const STORE_FRONT_URL = (process.env.NEXT_PUBLIC_STORE_FRONT_URL ?? '').replace(/\/+$/, '');
const STOREFRONT = '__storefront__';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname                        = usePathname();
  const { user, logout }                = useAuth();
  const { organization }                = useActiveOrganization();
  const slug                            = organization?.slug ?? null;
  const storeUrl                        = slug && STORE_FRONT_URL ? `${STORE_FRONT_URL}/${slug}` : null;
  const [devicesOpen, setDevicesOpen]   = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const groups = useMemo<NavGroup[]>(
    () => NAV_GROUPS.map((group) => ({
      label: group.label,
      items: group.items.map((item) => {
        const Icon = ICONS[item.icon] ?? Package;
        const external = item.href === STOREFRONT;
        return {
          href:     external ? (storeUrl ?? '#') : item.href,
          label:    item.name,
          icon:     <Icon />,
          external,
          disabled: external ? !storeUrl : !item.active,
          hint:     !external && !item.active ? 'Pronto' : undefined,
        };
      }),
    })),
    [storeUrl],
  );

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const label = user?.displayName ?? user?.email ?? 'Cuenta';
  const initial = label.slice(0, 1).toUpperCase();

  const rows = (
    <>
      {storeUrl && (
        <a href={storeUrl} target="_blank" rel="noopener noreferrer" className={rowClass}>
          <ExternalLink className="h-4 w-4" /> Ver tienda
        </a>
      )}
      <Button type="button" variant="ghost" onClick={() => setDevicesOpen(true)} className={buttonRowClass}>
        <MonitorSmartphone className="h-4 w-4" /> Dispositivos
      </Button>
      <Button type="button" variant="ghost" onClick={() => setFeedbackOpen(true)} className={buttonRowClass}>
        <LifeBuoy className="h-4 w-4" /> Informar un problema
      </Button>
      <Button type="button" variant="ghost" onClick={logout} className={buttonRowClass}>
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </Button>
    </>
  );

  const account = user
    ? (variant: AccountVariant) => {
        if (variant === 'sheet') {
          return (
            <>
              <div className="px-3 py-1"><p className="truncate text-sm font-medium">{label}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div>
              <div className="px-3 py-2"><ThemeToggle /></div>
              {rows}
            </>
          );
        }
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" aria-label="Menú de cuenta" className={`${buttonRowClass} h-auto ${variant === 'sidebar' ? '' : 'justify-center px-0'}`}>
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initial}</AvatarFallback>
                </Avatar>
                {variant === 'sidebar' && (
                  <>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-xs font-medium">{label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                    </span>
                    <EllipsisVertical className="h-4 w-4 text-muted-foreground" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side={variant === 'sidebar' ? 'top' : 'right'} align="start" className="w-60">
              <div className="px-2 py-1.5"><ThemeToggle /></div>
              <DropdownMenuSeparator />
              {storeUrl && (
                <DropdownMenuItem asChild>
                  <a href={storeUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Ver tienda</a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setDevicesOpen(true)}><MonitorSmartphone className="h-4 w-4" /> Dispositivos</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setFeedbackOpen(true)}><LifeBuoy className="h-4 w-4" /> Informar un problema</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={logout}><LogOut className="h-4 w-4" /> Cerrar sesión</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
    : undefined;

  return (
    <>
      <AppShell
        brand={{ name: siteConfig.name }}
        groups={groups}
        tabs={['/tienda/productos', '/tienda/pedidos', '/chat']}
        isActive={isActive}
        linkAs={Link}
        account={account}
        topbarActions={<ThemeToggle compact />}
      >
        {children}
      </AppShell>
      <ConnectedDevicesDialog open={devicesOpen} onOpenChange={setDevicesOpen} />
      <ConnectedFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} module="dashboard" />
    </>
  );
}

const buttonRowClass = 'w-full justify-start gap-3 px-3 font-medium';
const rowClass =
  'flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground';
