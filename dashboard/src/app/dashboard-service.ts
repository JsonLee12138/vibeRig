import type { DashboardRepository } from "./dashboard-model";
import { apiDashboardRepository } from "./api-repository";

let repository: DashboardRepository = apiDashboardRepository;

export function configureDashboardRepository(nextRepository: DashboardRepository) {
  repository = nextRepository;
}

export const dashboardService = {
  snapshot() {
    return repository.getSnapshot();
  },
};
