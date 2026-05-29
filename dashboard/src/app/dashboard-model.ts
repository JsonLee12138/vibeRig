export type TaskState = "Backlog" | "Ready" | "Running" | "Blocked" | "Human Review" | "Accepted";

export interface ProjectSummary {
  id: string;
  name: string;
  repository: string;
  branch: string;
  health: string;
  requirements: number;
  tasks: number;
  blockers: number;
  updatedAt: string;
}

export interface RequirementSummary {
  id: string;
  title: string;
  source: string;
  status: string;
  tasks: number;
  acceptance: number;
  updatedAt: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  state: TaskState;
  priority: "P0" | "P1" | "P2";
  owner: string;
  criteria: number;
  evidence: number;
  branch: string;
  reason?: string;
  latestRunStatus?: string;
  updatedAt: string;
}

export interface AcceptanceRow {
  requirement: string;
  taskId: string;
  taskName: string;
  status: TaskState;
  criteria: number;
  evidence: string;
}

export interface EvidenceItem {
  kind: string;
  label: string;
  path: string;
  status: string;
}

export interface RunLogLine {
  time: string;
  level: "info" | "warn" | "error" | "ok";
  message: string;
}

export interface DashboardSnapshot {
  projects: ProjectSummary[];
  requirements: RequirementSummary[];
  tasks: TaskSummary[];
  acceptance: AcceptanceRow[];
  evidence: EvidenceItem[];
  runLog: RunLogLine[];
}

export interface DashboardRepository {
  getSnapshot: () => Promise<DashboardSnapshot>;
}
