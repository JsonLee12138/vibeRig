import type {
  AcceptanceRow,
  DashboardRepository,
  DashboardSnapshot,
  EvidenceItem,
  ProjectSummary,
  RequirementSummary,
  RunLogLine,
  TaskState,
  TaskSummary,
} from "./dashboard-model";
import type { Board, Evidence, Project, Requirement, Run, Task, TaskStatus } from "./types";
import { api } from "./api";

const statusMap: Record<TaskStatus, TaskState> = {
  accepted: "Accepted",
  blocked: "Blocked",
  canceled: "Blocked",
  draft: "Backlog",
  failed: "Blocked",
  human_review: "Human Review",
  ready: "Ready",
  running: "Running",
  self_accepted: "Human Review",
};

function currentSearch() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}

function currentTaskId() {
  if (typeof window === "undefined") {
    return "";
  }
  const match = window.location.pathname.match(/\/(?:tasks|runs)\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function relativeTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function timeLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function priorityLabel(priority?: number): TaskSummary["priority"] {
  if ((priority ?? 100) <= 25) return "P0";
  if ((priority ?? 100) <= 75) return "P1";
  return "P2";
}

function taskState(status: TaskStatus): TaskState {
  return statusMap[status] ?? "Backlog";
}

function taskCriteria(task: Task) {
  const progress = task.acceptance_progress;
  if (!progress?.total) return task.status === "accepted" ? 100 : 0;
  return Math.round((progress.completed / progress.total) * 100);
}

function evidenceLabel(count: number) {
  if (count === 0) return "none";
  if (count === 1) return "1 file";
  return `${count} files`;
}

function requirementAcceptance(board: Board) {
  const total = board.acceptance_items.length;
  if (!total) return 0;
  const completed = board.acceptance_items.filter((item) => item.status === "passed" || item.status === "waived").length;
  return Math.round((completed / total) * 100);
}

function toProjectSummary(project: Project, requirements: Requirement[], boards: Board[]): ProjectSummary {
  const tasks = boards.flatMap((board) => board.tasks);
  const blockers = tasks.filter((task) => task.status === "blocked" || task.status === "failed").length;
  return {
    id: project.id,
    name: project.name,
    repository: project.project_root,
    branch: project.status || "active",
    health: blockers ? "Needs review" : requirements.length ? "Healthy" : "Drafting",
    requirements: requirements.length,
    tasks: tasks.length,
    blockers,
    updatedAt: relativeTime(project.updated_at || project.created_at),
  };
}

function toRequirementSummary(requirement: Requirement, board?: Board): RequirementSummary {
  return {
    id: requirement.requirement_id,
    title: requirement.title,
    source: requirement.source_path || requirement.id || requirement.requirement_id,
    status: board?.tasks.some((task) => task.definition_stale) ? "Needs review" : "Mapped",
    tasks: board?.tasks.length ?? 0,
    acceptance: board ? requirementAcceptance(board) : 0,
    updatedAt: relativeTime(requirement.updated_at || requirement.created_at),
  };
}

function toTaskSummary(task: Task): TaskSummary {
  const latestRun = task.latest_run;
  return {
    id: task.task_id,
    title: task.title,
    state: taskState(task.status),
    priority: priorityLabel(task.priority),
    owner: task.review_agent || task.acceptance_agent || task.suggested_agent || "codex",
    criteria: taskCriteria(task),
    evidence: task.evidence_count ?? 0,
    branch: task.branch || task.worktree_hint || "",
    reason: task.status_reason || task.blocked_reason || latestRun?.error_summary || latestRun?.summary,
    latestRunStatus: latestRun?.implementation_status || latestRun?.status,
    updatedAt: timeLabel(task.updated_at) || relativeTime(task.updated_at),
  };
}

function toAcceptanceRows(board: Board): AcceptanceRow[] {
  const taskByDbId = new Map(board.tasks.map((task) => [task.id, task]));
  return board.task_acceptance_links.map((link) => {
    const task = taskByDbId.get(link.task_id);
    const item = board.acceptance_items.find((acceptance) => acceptance.id === link.acceptance_item_id);
    return {
      requirement: item?.title || item?.acceptance_id || link.acceptance_item_id,
      taskId: task?.task_id || link.task_id,
      taskName: task?.title || link.task_id,
      status: task ? taskState(task.status) : "Backlog",
      criteria: task ? taskCriteria(task) : 0,
      evidence: evidenceLabel(task?.evidence_count ?? 0),
    };
  });
}

function toEvidenceItem(evidence: Evidence): EvidenceItem {
  return {
    kind: evidence.kind,
    label: evidence.summary || evidence.kind,
    path: evidence.path || "",
    status: "Linked",
  };
}

function toRunLogLine(line: string, index: number): RunLogLine {
  const level = /\berror\b/i.test(line)
    ? "error"
    : /\bwarn(?:ing)?\b/i.test(line)
      ? "warn"
      : /\b(?:ok|success|passed)\b/i.test(line)
        ? "ok"
        : "info";
  return {
    time: String(index + 1).padStart(2, "0"),
    level,
    message: line,
  };
}

async function safeBoard(projectId: string, requirementId: string) {
  try {
    return await api.board(projectId, requirementId);
  } catch {
    return null;
  }
}

async function selectedRunLog(projectId: string, requirementId: string, taskId: string, tasks: Task[]): Promise<RunLogLine[]> {
  const selectedTaskId = taskId || tasks.find((task) => task.latest_run)?.task_id || tasks[0]?.task_id || "";
  if (!selectedTaskId) return [];
  try {
    const detail = await api.task(projectId, requirementId, selectedTaskId);
    const run: Run | undefined = detail.runs[0] || detail.task.latest_run || undefined;
    if (!run?.id) return [];
    const log = await api.runLog(run.id);
    return log.split(/\r?\n/).filter(Boolean).map(toRunLogLine);
  } catch {
    return [];
  }
}

export const apiDashboardRepository: DashboardRepository = {
  async getSnapshot(): Promise<DashboardSnapshot> {
    const projects = await api.projects();
    const search = currentSearch();
    const selectedProjectId = search.get("project") || projects[0]?.id || "";
    const selectedProject = projects.find((project) => project.id === selectedProjectId) || projects[0];

    const projectEntries = await Promise.all(projects.map(async (project) => {
      const requirements = await api.requirements(project.id);
      const boards = (await Promise.all(requirements.map((requirement) => safeBoard(project.id, requirement.requirement_id))))
        .filter((board): board is Board => Boolean(board));
      return { boards, project, requirements };
    }));

    const selectedEntry = projectEntries.find((entry) => entry.project.id === selectedProject?.id) || projectEntries[0];
    const selectedRequirementId = search.get("requirement") || selectedEntry?.requirements[0]?.requirement_id || "";
    const selectedBoard = selectedEntry?.boards.find((board) => board.requirement.requirement_id === selectedRequirementId) || selectedEntry?.boards[0] || null;

    const tasks = selectedBoard?.tasks ?? [];
    const evidence = selectedProject && selectedBoard
      ? await api.evidence(selectedProject.id, selectedBoard.requirement.requirement_id).catch(() => [] as Evidence[])
      : [];

    return {
      projects: projectEntries.map((entry) => toProjectSummary(entry.project, entry.requirements, entry.boards)),
      requirements: selectedEntry?.requirements.map((requirement) => (
        toRequirementSummary(
          requirement,
          selectedEntry.boards.find((board) => board.requirement.requirement_id === requirement.requirement_id),
        )
      )) ?? [],
      tasks: tasks.map(toTaskSummary),
      acceptance: selectedBoard ? toAcceptanceRows(selectedBoard) : [],
      evidence: evidence.map(toEvidenceItem),
      runLog: selectedProject && selectedBoard
        ? await selectedRunLog(selectedProject.id, selectedBoard.requirement.requirement_id, currentTaskId(), tasks)
        : [],
    };
  },
};
