import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardService } from "./dashboard-service";
import { subscribeToEvents } from "./events";

export function useDashboardSnapshot() {
  const queryClient = useQueryClient();
  useEffect(
    () => subscribeToEvents(() => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
    }),
    [queryClient],
  );
  return useQuery({
    queryKey: ["dashboard-snapshot"],
    queryFn: () => dashboardService.snapshot(),
    staleTime: 60_000,
  });
}
