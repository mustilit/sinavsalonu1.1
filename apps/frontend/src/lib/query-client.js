import { QueryClient } from '@tanstack/react-query';

/**
 * Uygulama genelinde paylaşılan React Query istemcisi.
 * refetchOnWindowFocus: false — sekmeye geri döndüğünde gereksiz API çağrısını önler
 * retry: 1 — başarısız isteklerde en fazla 1 yeniden deneme
 */
export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});