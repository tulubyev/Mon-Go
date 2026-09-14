import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

// staleTime/gcTime deliberately long — this is prepared content that
// changes via the admin panel, not every launch. The existing
// PersistQueryClientProvider (app/_layout.tsx) already persists react-query
// to AsyncStorage, so once fetched once, both queries below serve instantly
// offline for up to a week without any extra caching code here.
const STALE_TIME = 30 * 60_000; // 30 min
const GC_TIME = 7 * 24 * 60 * 60_000; // 7 days

export function useContentManifest(lang: string) {
  return useQuery({
    queryKey: ['content-manifest', lang],
    queryFn: () => api.getContentManifest(lang),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

export function useSubtopicContent(slug: string | undefined, lang: string) {
  return useQuery({
    queryKey: ['content-subtopic', slug, lang],
    queryFn: () => api.getSubtopicContent(slug!, lang),
    enabled: !!slug,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}
