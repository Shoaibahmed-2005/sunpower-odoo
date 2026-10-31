// Owned by C — placeholder stub so the shell compiles.
// C replaces with real QueryClient (staleTime: 0, refetchOnWindowFocus: true, refetchInterval on lists).
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, refetchOnWindowFocus: true },
  },
});

