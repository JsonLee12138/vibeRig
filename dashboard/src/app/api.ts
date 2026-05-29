import type {
  AcceptanceItem,
  Board,
  Evidence,
  ManualReview,
  Project,
  Requirement,
  ReviewResult,
  Run,
  RunDetail,
  Task,
  TaskDetail,
  TaskStatus,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => ({ error: response.statusText }));
  if (!response.ok) {
    throw new Error(payload.error || response.statusText);
  }
  return payload as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  async projects(): Promise<Project[]> {
    return (await request<{ projects: Project[] }>("/api/projects")).projects;
  },
  async registerProject(projectRoot: string, projectName?: string): Promise<Project> {
    const body: { project_root: string; project_name?: string } = { project_root: projectRoot };
    if (projectName) {
      body.project_name = projectName;
    }
    return (await post<{ project: Project }>("/api/projects/register", body)).project;
  },
  async deleteProject(projectId: string): Promise<Project> {
    return (await post<{ project: Project }>("/api/projects/delete", { project_id: projectId })).project;
  },
  async refreshProject(projectId: string): Promise<void> {
    await post("/api/projects/refresh", { project_id: projectId });
  },
  async refreshRequirement(projectId: string, requirementId: string): Promise<void> {
    await post("/api/requirements/refresh", {
      project_id: projectId,
      requirement_id: requirementId,
    });
  },
  async requirements(projectId: string): Promise<Requirement[]> {
    return (
      await request<{ requirements: Requirement[] }>(
        `/api/requirements?project_id=${encodeURIComponent(projectId)}`,
      )
    ).requirements;
  },
  async board(projectId: string, requirementId: string): Promise<Board> {
    return (
      await request<{ board: Board }>(
        `/api/board?project_id=${encodeURIComponent(projectId)}&requirement_id=${encodeURIComponent(requirementId)}`,
      )
    ).board;
  },
  async task(projectId: string, requirementId: string, taskId: string): Promise<TaskDetail> {
    return request<TaskDetail>(
      `/api/tasks/get?project_id=${encodeURIComponent(projectId)}&requirement_id=${encodeURIComponent(
        requirementId,
      )}&task_id=${encodeURIComponent(taskId)}`,
    );
  },
  async updateTaskStatus(
    projectId: string,
    requirementId: string,
    taskId: string,
    status: TaskStatus,
    reason?: string,
  ): Promise<Task> {
    return (
      await post<{ task: Task }>("/api/tasks/update_status", {
        project_id: projectId,
        requirement_id: requirementId,
        task_id: taskId,
        status,
        reason,
      })
    ).task;
  },
  async updateTaskOrder(projectId: string, requirementId: string, taskIds: string[]): Promise<void> {
    await post("/api/tasks/update_order", {
      project_id: projectId,
      requirement_id: requirementId,
      task_ids: taskIds,
    });
  },
  async updateAcceptanceStatus(
    projectId: string,
    requirementId: string,
    acceptanceId: string,
    status: string,
  ): Promise<AcceptanceItem> {
    return (
      await post<{ acceptance: AcceptanceItem }>("/api/acceptance/update_status", {
        project_id: projectId,
        requirement_id: requirementId,
        acceptance_id: acceptanceId,
        status,
      })
    ).acceptance;
  },
  async recordManualReview(
    projectId: string,
    requirementId: string,
    taskId: string,
    reviewer: string,
    result: ReviewResult,
    notes: string,
    residualRisks: string,
    evidenceReviewed: string[],
  ): Promise<ManualReview> {
    return (
      await post<{ review: ManualReview }>("/api/reviews/record_manual_review", {
        project_id: projectId,
        requirement_id: requirementId,
        task_id: taskId,
        reviewer,
        result,
        notes,
        residual_risks: residualRisks,
        evidence_reviewed: evidenceReviewed,
      })
    ).review;
  },
  async runTask(projectId: string, requirementId: string, taskId: string): Promise<Run> {
    return (
      await post<{ run: Run }>(`/api/tasks/${encodeURIComponent(taskId)}/runs`, {
        project_id: projectId,
        requirement_id: requirementId,
      })
    ).run;
  },
  async resumeTask(projectId: string, requirementId: string, taskId: string, comment?: string): Promise<Run> {
    return (
      await post<{ run: Run }>(`/api/tasks/${encodeURIComponent(taskId)}/runs/continue-after-fix`, {
        project_id: projectId,
        requirement_id: requirementId,
        comment,
      })
    ).run;
  },
  async rerunTask(projectId: string, requirementId: string, taskId: string, reason?: string): Promise<Run> {
    return (
      await post<{ run: Run }>(`/api/tasks/${encodeURIComponent(taskId)}/runs/rerun`, {
        project_id: projectId,
        requirement_id: requirementId,
        reason,
      })
    ).run;
  },
  async run(runId: string): Promise<RunDetail> {
    return request<RunDetail>(`/api/runs/${encodeURIComponent(runId)}`);
  },
  async cancelRun(runId: string, reason = "canceled from dashboard"): Promise<Run> {
    return (
      await post<{ run: Run }>(`/api/runs/${encodeURIComponent(runId)}/cancel`, {
        reason,
      })
    ).run;
  },
  async runLog(runId: string): Promise<string> {
    return (await request<{ log: string }>(`/api/runs/${encodeURIComponent(runId)}/log`)).log;
  },
  async evidence(projectId: string, requirementId: string): Promise<Evidence[]> {
    return (
      await request<{ evidence: Evidence[] }>(
        `/api/evidence/list?project_id=${encodeURIComponent(projectId)}&requirement_id=${encodeURIComponent(requirementId)}`,
      )
    ).evidence;
  },
  async discoverEvidence(projectId: string, requirementId: string): Promise<Evidence[]> {
    return (
      await post<{ evidence: { recorded?: Evidence[] } }>("/api/evidence/discover", {
        project_id: projectId,
        requirement_id: requirementId,
      })
    ).evidence.recorded || [];
  },
};
