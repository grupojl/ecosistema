import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/config/constants';
import { getBalance, getTransacciones } from '@/features/pagos/services/pagos.service';
import type { TransaccionFilters } from '@/features/pagos/types';

export function useBalanceSummary() {
  return useQuery({
    queryKey:  QUERY_KEYS.balance,
    queryFn:   getBalance,
    staleTime: 1000 * 60 * 2,
  });
}

export function useTransacciones(filters: TransaccionFilters = {}) {
  return useQuery({
    queryKey:  [...QUERY_KEYS.transacciones, filters],
    queryFn:   () => getTransacciones(filters),
    staleTime: 1000 * 60,
  });
}
