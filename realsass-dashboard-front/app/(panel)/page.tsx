'use client';

import { Landmark, MessageSquare, TrendingUp, Users } from 'lucide-react';
import { PageContainer, PageHeader, StatCard } from '@real/ui';
import { trpc } from '@/lib/trpc/client';

export default function DashboardPage() {
  const { data: municipality } = trpc.municipio.get.useQuery();
  const { data: entities } = trpc.organigrama.list.useQuery();

  return (
    <PageContainer>
      <PageHeader title="Resumen" description={municipality?.name ?? 'Vista general de tu municipio'} />

      <div className="grid grid-cols-2 gap-4 expanded:grid-cols-4">
        <StatCard icon={<Landmark />}       label="Entes"          value={entities?.length ?? 0} />
        <StatCard icon={<MessageSquare />}  label="Conversaciones" value="—" />
        <StatCard icon={<TrendingUp />}     label="Campañas"       value="—" />
        <StatCard icon={<Users />}          label="Ciudadanos"     value="—" />
      </div>
    </PageContainer>
  );
}
