'use client';

/**
 * Armazón del panel: navegación adaptable de Welver (barra inferior en compact, riel en medium, barra lateral en
 * expanded). Los destinos salen de `config/navigation.ts`; la forma la pone `AppShell` de @real/ui.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Package,
  MessageSquare, CreditCard, TrendingUp,
  Palette, ToggleLeft, Webhook, ChartColumnBig, Building2, Store, MonitorDown,
  LogOut, MonitorSmartphone, LifeBuoy, EllipsisVertical,
} from 'lucide-react';
import {
  AppShell, Avatar, AvatarFallback, AvatarImage, Button, ThemeToggle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  type AccountVariant, type NavGroup,
} from '@real/ui';
import { ConnectedDevicesDialog } from '@/components/devices-dialog-connected';
import { ConnectedFeedbackDialog } from '@/components/feedback-dialog-connected';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { siteConfig } from '@/config/site';
import { NAV_GROUPS } from '@/config/navigation';

const ICONS: Record<string, React.ElementType> = {
  Package,
  MessageSquare, CreditCard, TrendingUp,
  Palette, ToggleLeft, Webhook, ChartColumnBig, Building2, Store, MonitorDown,
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname                        = usePathname();
  const { user, logout }                = useAuth();
  const [devicesOpen, setDevicesOpen]   = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const groups = useMemo<NavGroup[]>(
    () => NAV_GROUPS.map((group) => ({
      label: group.label,
      items: group.items.map((item) => {
        const Icon = ICONS[item.icon] ?? Package;
        return {
          href:     item.href,
          label:    item.name,
          icon:     <Icon />,
          disabled: !item.active,
          hint:     !item.active ? 'Pronto' : undefined,
        };
      }),
    })),
    [],
  );

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const label = user?.displayName ?? user?.email ?? 'Cuenta';
  const initial = label.slice(0, 1).toUpperCase();

  const rows = (
    <>
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
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />}
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
        tabs={['/', '/chat', '/configuracion/general']}
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
