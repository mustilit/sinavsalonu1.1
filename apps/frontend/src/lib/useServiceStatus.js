/**
 * useServiceStatus — fetches the 4 kill-switch flags from the backend.
 * Returns { purchasesEnabled, packageCreationEnabled, testPublishingEnabled, testAttemptsEnabled }
 * All default to true (open) while loading or on error (fail-open strategy).
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api/apiClient';

const DEFAULTS = {
  purchasesEnabled: true,
  packageCreationEnabled: true,
  testPublishingEnabled: true,
  testAttemptsEnabled: true,
};

export function useServiceStatus() {
  const { data } = useQuery({
    queryKey: ['service-status'],
    queryFn: async () => {
      const { data } = await api.get('/site/service-status');
      return data ?? DEFAULTS;
    },
    staleTime: 60 * 1000,      // re-check every 60 s
    gcTime: 2 * 60 * 1000,
    retry: 1,
    // fail-open: if the fetch fails, keep defaults (all enabled)
    placeholderData: DEFAULTS,
  });
  return data ?? DEFAULTS;
}
