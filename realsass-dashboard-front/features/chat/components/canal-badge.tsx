import { Phone, Camera, Globe, MessageSquare } from 'lucide-react';
import { Badge, cn } from '@real/ui';
import type { Canal } from '@/features/chat/types';

const CANAL_CONFIG: Record<Canal, { label: string; color: string; Icon: React.ElementType }> = {
  whatsapp:  { label: 'WhatsApp',  color: 'bg-success/15 border-success/30',         Icon: Phone },
  instagram: { label: 'Instagram', color: 'bg-destructive/10 border-destructive/30', Icon: Camera },
  telegram:  { label: 'Telegram',  color: 'bg-primary/10 border-primary/30',         Icon: MessageSquare },
  web:       { label: 'Web',       color: 'bg-muted border-border',                  Icon: Globe },
};

export function CanalBadge({ canal }: { canal: Canal }) {
  const cfg  = CANAL_CONFIG[canal];
  const Icon = cfg.Icon;
  return (
    <Badge variant="outline" className={cn('gap-1 px-1.5 py-0.5 text-[10px] text-foreground', cfg.color)}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </Badge>
  );
}
