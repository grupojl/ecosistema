'use client';

import { Package, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import { PageContainer, PageHeader, StatCard } from '@real/ui';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useOrders, useProducts } from '@/features/store/hooks';

export default function DashboardPage() {
  const { organizationId } = useAuth();
  const { data: ordersData } = useOrders(organizationId);
  const { data: productsData } = useProducts(organizationId);

  const totalOrders   = ordersData?.length ?? 0;
  const totalProducts = productsData?.filter((p) => p.status !== 'ARCHIVED').length ?? 0;

  return (
    <PageContainer>
      <PageHeader title="Resumen" description="Vista general de tu organización" />

      <div className="grid grid-cols-2 gap-4 expanded:grid-cols-4">
        <StatCard icon={<Package />}     label="Productos" value={totalProducts} />
        <StatCard icon={<ShoppingBag />} label="Pedidos"   value={totalOrders} />
        <StatCard icon={<TrendingUp />}  label="Campañas"  value="—" />
        <StatCard icon={<Users />}       label="Clientes"  value="—" />
      </div>
    </PageContainer>
  );
}
