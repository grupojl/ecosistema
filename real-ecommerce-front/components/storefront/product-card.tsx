import Link from 'next/link';
import type { ProductView } from '@/lib/catalog/product-view';

interface ProductCardProps {
  href:         string;
  product:      ProductView;
  priceLabel:   string | null;
  noImageLabel: string;
}

/** Server Component — sin JS en el cliente. */
export function ProductCard({ href, product, priceLabel, noImageLabel }: ProductCardProps) {
  return (
    <Link
      href={href}
      className="group border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
        <span className="text-muted-foreground text-xs" aria-hidden="true">{noImageLabel}</span>
      </div>
      <div className="p-4 space-y-1">
        <h3 className="font-medium text-sm line-clamp-2">{product.name}</h3>
        {priceLabel && <p className="text-muted-foreground text-sm">{priceLabel}</p>}
      </div>
    </Link>
  );
}
