export const NAV_GROUPS = [
  {
    label: 'Tienda',
    items: [
      { name: 'Productos',  href: '/tienda/productos', icon: 'Package',     active: true  },
      { name: 'Pedidos',    href: '/tienda/pedidos',   icon: 'ShoppingBag', active: true  },
      { name: 'Ver tienda', href: '__storefront__',              icon: 'ExternalLink', active: true },
    ],
  },
  {
    label: 'Módulos',
    items: [
      { name: 'Chat IA',  href: '/chat',     icon: 'MessageSquare', active: true  },
      { name: 'Pagos',    href: '/pagos',    icon: 'CreditCard',    active: false },
      { name: 'Campañas', href: '/campanas', icon: 'TrendingUp',    active: false },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { name: 'General',       href: '/configuracion/general',  icon: 'Building2',  active: true },
      { name: 'Storefront',    href: '/configuracion/tienda',   icon: 'Store',      active: true },
      { name: 'Tema visual',   href: '/configuracion/tema',     icon: 'Palette',    active: true },
      { name: 'Feature Flags', href: '/configuracion/flags',    icon: 'ToggleLeft', active: true },
      { name: 'Webhooks',      href: '/configuracion/webhooks', icon: 'Webhook',    active: true },
      { name: 'Quotas',        href: '/configuracion/quotas',   icon: 'ChartColumnBig',  active: true },
    ],
  },
] as const;
