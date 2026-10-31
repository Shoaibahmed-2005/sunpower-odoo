/**
 * React Query Client configuration with 5s polling for multi-user live sync.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchInterval: 5000,
      retry: 1,
    },
  },
});
