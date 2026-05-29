import type { Board, Project, Requirement, ReviewResult, TaskDetail, TaskStatus } from "./types";
import { ChevronRight, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AcceptanceOverview } from "../acceptance/AcceptanceOverview";
import { orderedTaskIds } from "../board/boardRules";
import { TaskBoard } from "../board/TaskBoard";
import { ProjectInsights } from "../insights/ProjectInsights";
import { ProjectGallery } from "../projects/ProjectGallery";
import { ProjectSelector } from "../projects/ProjectSelector";
import { ProjectSummary } from "../projects/ProjectSummary";
import { RequirementHeader } from "../requirements/RequirementHeader";
import { RequirementSelector } from "../requirements/RequirementSelector";
import { RunExplorer } from "../runs/RunExplorer";
import { EmptyState } from "../shared/EmptyState";
import { ToolbarButton } from "../shared/ToolbarButton";
import { TaskDrawer } from "../task-detail/TaskDrawer";
import { api } from "./api";
import { subscribeToEvents } from "./events";

type DashboardView = "projects" | "board" | "matrix" | "insights" | "runs";

function getQuery() {
  return new URLSearchParams(window.location.search);
}

function setQuery(values: Record<string, string | undefined>) {
  const query = getQuery();
  Object.entries(values).forEach(([key, value]) => {
    if (value) query.set(key, value);
    else query.delete(key);
  });
  window.history.replaceState(null, "", `${window.location.pathname}?${query.toString()}`);
}

function getInitialView(query: URLSearchParams): DashboardView {
  const value = query.get("view");
  if (value === "projects" || value === "board" || value === "matrix" || value === "insights" || value === "runs") {
    return value;
  }
  return query.get("project") ? "board" : "projects";
}

const viewTitles: Record<DashboardView, string> = {
  projects: "Project Selection",
  board: "Task Kanban",
  matrix: "Acceptance Matrix",
  insights: "Project Insights",
  runs: "Run Explorer",
};

export function DashboardApp() {
  const initialQuery = useMemo(getQuery, []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState(initialQuery.get("project") || "");
  const [selectedRequirementId, setSelectedRequirementId] = useState(initialQuery.get("requirement") || "");
  const [selectedTaskId, setSelectedTaskId] = useState(initialQuery.get("task") || "");
  const [selectedRunId, setSelectedRunId] = useState(initialQuery.get("run") || "");
  const [activeView, setActiveView] = useState<DashboardView>(getInitialView(initialQuery));
  const [registerProjectRoot, setRegisterProjectRoot] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedRequirement = requirements.find((requirement) => requirement.requirement_id === selectedRequirementId);

  const switchView = useCallback(
    (view: DashboardView, values: Record<string, string | undefined> = {}) => {
      setActiveView(view);
      setQuery({ view, ...values });
    },
    [],
  );

  const loadProjects = useCallback(async () => {
    const nextProjects = await api.projects();
    setProjects(nextProjects);

    if (selectedProjectId && !nextProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId("");
      setSelectedRequirementId("");
      setSelectedTaskId("");
      setSelectedRunId("");
      setQuery({ project: undefined, requirement: undefined, task: undefined, run: undefined, view: "projects" });
      setActiveView("projects");
    }
  }, [selectedProjectId]);

  const loadRequirements = useCallback(async () => {
    if (!selectedProjectId) {
      setRequirements([]);
      setBoard(null);
      return;
    }
    const nextRequirements = await api.requirements(selectedProjectId);
    setRequirements(nextRequirements);
    const valid = nextRequirements.some((item) => item.requirement_id === selectedRequirementId);
    if (!valid) {
      const nextId = nextRequirements[0]?.requirement_id || "";
      setSelectedRequirementId(nextId);
      setSelectedTaskId("");
      setSelectedRunId("");
      setQuery({ project: selectedProjectId, requirement: nextId || undefined, task: undefined, run: undefined });
    }
  }, [selectedProjectId, selectedRequirementId]);

  const loadBoard = useCallback(async () => {
    if (!selectedProjectId || !selectedRequirementId) {
      setBoard(null);
      return;
    }
    const nextBoard = await api.board(selectedProjectId, selectedRequirementId);
    setBoard(nextBoard);
  }, [selectedProjectId, selectedRequirementId]);

  const loadTask = useCallback(async () => {
    if (!selectedProjectId || !selectedRequirementId || !selectedTaskId) {
      setTaskDetail(null);
      return;
    }
    setTaskDetail(await api.task(selectedProjectId, selectedRequirementId, selectedTaskId));
  }, [selectedProjectId, selectedRequirementId, selectedTaskId]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await loadProjects();
      await loadRequirements();
      await loadBoard();
      await loadTask();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [loadBoard, loadProjects, loadRequirements, loadTask]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    loadRequirements().catch((reason) => setError(reason.message));
  }, [loadRequirements]);

  useEffect(() => {
    loadBoard().catch((reason) => setError(reason.message));
  }, [loadBoard]);

  useEffect(() => {
    loadTask().catch((reason) => setError(reason.message));
  }, [loadTask]);

  useEffect(() => subscribeToEvents(() => refreshAll()), [refreshAll]);

  useEffect(() => {
    if (!selectedProjectId && activeView !== "projects") {
      switchView("projects", { project: undefined, requirement: undefined, task: undefined, run: undefined });
    }
  }, [activeView, selectedProjectId, switchView]);

  useEffect(() => {
    if (!selectedRunId && taskDetail?.runs[0]?.id) {
      setSelectedRunId(taskDetail.runs[0].id);
    }
  }, [selectedRunId, taskDetail]);

  const selectProject = (projectId: string, nextView: DashboardView = activeView) => {
    setSelectedProjectId(projectId);
    setSelectedRequirementId("");
    setSelectedTaskId("");
    setSelectedRunId("");
    setTaskDetail(null);
    switchView(nextView, {
      project: projectId,
      requirement: undefined,
      task: undefined,
      run: undefined,
    });
  };

  const selectRequirement = (requirementId: string) => {
    setSelectedRequirementId(requirementId);
    setSelectedTaskId("");
    setSelectedRunId("");
    setTaskDetail(null);
    switchView(activeView === "projects" ? "board" : activeView, {
      project: selectedProjectId,
      requirement: requirementId,
      task: undefined,
      run: undefined,
    });
  };

  const openTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    switchView(activeView === "board" || activeView === "runs" ? activeView : "board", {
      project: selectedProjectId,
      requirement: selectedRequirementId,
      task: taskId,
      run: undefined,
    });
  };

  const openRun = (runId: string) => {
    setSelectedRunId(runId);
    switchView("runs", {
      project: selectedProjectId,
      requirement: selectedRequirementId,
      task: selectedTaskId || taskDetail?.task.task_id,
      run: runId,
    });
  };

  const openBoardRun = (runId: string) => {
    const taskId = board?.tasks.find((task) => task.latest_run?.id === runId)?.task_id || selectedTaskId || taskDetail?.task.task_id;
    if (taskId) {
      setSelectedTaskId(taskId);
    }
    setSelectedRunId(runId);
    switchView("runs", {
      project: selectedProjectId,
      requirement: selectedRequirementId,
      task: taskId,
      run: runId,
    });
  };

  const moveStatus = async (taskId: string, status: TaskStatus) => {
    setError("");
    const reason = status === "ready" || status === "canceled" ? window.prompt("Reason, if required") || undefined : undefined;
    try {
      await api.updateTaskStatus(selectedProjectId, selectedRequirementId, taskId, status, reason);
      await loadBoard();
      if (selectedTaskId === taskId) await loadTask();
    } catch (reasonError) {
      await loadBoard();
      setError(`Status change to ${status} failed: ${reasonError instanceof Error ? reasonError.message : String(reasonError)}`);
    }
  };

  const reorderTask = async (taskId: string, direction: "up" | "down") => {
    if (!board) return;
    const task = board.tasks.find((item) => item.task_id === taskId);
    if (!task) return;
    const columnTaskIds = board.tasks
      .filter((item) => item.status === task.status)
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((item) => item.task_id);
    await api.updateTaskOrder(selectedProjectId, selectedRequirementId, orderedTaskIds(columnTaskIds, taskId, direction));
    await loadBoard();
  };

  const runTask = async (taskId: string) => {
    setError("");
    try {
      await api.runTask(selectedProjectId, selectedRequirementId, taskId);
      await refreshAll();
    } catch (reason) {
      setError(`Run failed: ${reason instanceof Error ? reason.message : String(reason)}`);
    }
  };

  const refreshProject = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError("");
    try {
      await api.refreshProject(selectedProjectId);
      await refreshAll();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  const refreshRequirement = async () => {
    if (!selectedProjectId || !selectedRequirementId) return;
    setLoading(true);
    setError("");
    try {
      await api.refreshRequirement(selectedProjectId, selectedRequirementId);
      await loadRequirements();
      await loadBoard();
      await loadTask();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  const registerProject = async () => {
    if (!registerProjectRoot.trim()) {
      setError("Project root path is required.");
      return;
    }
    try {
      const project = await api.registerProject(registerProjectRoot.trim());
      setRegisterProjectRoot("");
      setSelectedProjectId(project.id);
      setSelectedRequirementId("");
      setSelectedTaskId("");
      setSelectedRunId("");
      switchView("board", { project: project.id, requirement: undefined, task: undefined, run: undefined });
      await refreshAll();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const updateAcceptanceStatus = async (acceptanceId: string, status: string) => {
    await api.updateAcceptanceStatus(selectedProjectId, selectedRequirementId, acceptanceId, status);
    await refreshAll();
  };

  const submitManualReview = async (
    reviewer: string,
    result: ReviewResult,
    notes: string,
    residualRisks: string,
    evidenceReviewed: string[],
  ) => {
    if (!selectedTaskId) return;
    try {
      await api.recordManualReview(
        selectedProjectId,
        selectedRequirementId,
        selectedTaskId,
        reviewer,
        result,
        notes,
        residualRisks,
        evidenceReviewed,
      );
      await refreshAll();
    } catch (reason) {
      setError(`Review failed: ${reason instanceof Error ? reason.message : String(reason)}`);
    }
  };

  const discoverEvidence = async () => {
    if (!selectedProjectId || !selectedRequirementId) return;
    await api.discoverEvidence(selectedProjectId, selectedRequirementId);
    await refreshAll();
  };

  const renderBoardWorkspace = () => (
    <main className="workspace">
      <section className="board-pane">
        <RequirementHeader board={board} onSync={refreshRequirement} loading={loading} />
        {!selectedProjectId ? (
          <EmptyState title="Select a project" />
        ) : !selectedRequirementId ? (
          <EmptyState title="Select a requirement" detail="Pick an imported requirement to open the Kanban workflow." />
        ) : (
          <TaskBoard
            board={board}
            onOpenTask={openTask}
            onOpenRun={openBoardRun}
            onMoveStatus={moveStatus}
            onRunTask={runTask}
            onReorder={reorderTask}
          />
        )}
      </section>
      <TaskDrawer
        detail={taskDetail}
        onClose={() => {
          setSelectedTaskId("");
          setTaskDetail(null);
          switchView("board", { project: selectedProjectId, requirement: selectedRequirementId, task: undefined, run: undefined });
        }}
        onOpenTask={openTask}
        onOpenRun={openRun}
        onRunTask={runTask}
        onAcceptanceStatus={updateAcceptanceStatus}
        onManualReview={submitManualReview}
      />
    </main>
  );

  const renderMainContent = () => {
    if (activeView === "projects" || !selectedProjectId) {
      return (
        <ProjectGallery
          board={board}
          loading={loading}
          projectRoot={registerProjectRoot}
          projects={projects}
          requirements={requirements}
          selectedProjectId={selectedProjectId}
          onChangeProjectRoot={setRegisterProjectRoot}
          onOpenBoard={(projectId) => selectProject(projectId, "board")}
          onRefreshProject={refreshProject}
          onRegisterProject={registerProject}
          onSelectProject={(projectId) => selectProject(projectId, "projects")}
        />
      );
    }

    if (activeView === "matrix") {
      return <AcceptanceOverview board={board} onBackToBoard={() => switchView("board")} onOpenTask={openTask} />;
    }

    if (activeView === "insights") {
      return <ProjectInsights board={board} project={selectedProject} requirements={requirements} onBackToBoard={() => switchView("board")} />;
    }

    if (activeView === "runs") {
      return taskDetail ? (
        <RunExplorer detail={taskDetail} runId={selectedRunId} onBackToBoard={() => switchView("board", { run: undefined })} onSelectRun={setSelectedRunId} />
      ) : (
        <section className="page-shell">
          <EmptyState title="Open a task run first" detail="Select a task from the board, then open one of its runs to view the full execution log." />
        </section>
      );
    }

    return renderBoardWorkspace();
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-main">
          <div className="brand-lockup">
            <div className="brand">VibeRig</div>
            <div className="topbar-copy">
              <p className="eyebrow">{viewTitles[activeView]}</p>
              <div className="breadcrumb" aria-label="Current selection">
                <span>Projects</span>
                <ChevronRight size={14} className="breadcrumb-separator" />
                <span>{selectedProject?.name || "Select project"}</span>
                <ChevronRight size={14} className="breadcrumb-separator" />
                <span>{selectedRequirement?.title || viewTitles[activeView]}</span>
              </div>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="view-switcher">
              <ToolbarButton label="Projects" variant={activeView === "projects" ? "primary" : "default"} onClick={() => switchView("projects")} />
              <ToolbarButton label="Board" variant={activeView === "board" ? "primary" : "default"} onClick={() => switchView("board")} />
              <ToolbarButton label="Matrix" variant={activeView === "matrix" ? "primary" : "default"} onClick={() => switchView("matrix")} disabled={!selectedRequirementId} />
              <ToolbarButton label="Insights" variant={activeView === "insights" ? "primary" : "default"} onClick={() => switchView("insights")} disabled={!selectedRequirementId} />
            </div>
            <ToolbarButton icon={<RefreshCw size={16} />} label="Refresh Board" onClick={refreshAll} />
            <ToolbarButton icon={<Search size={16} />} label="Discover Evidence" onClick={discoverEvidence} disabled={!selectedRequirementId} />
          </div>
        </div>
        <div className="topbar-panels">
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelect={(projectId) => selectProject(projectId, activeView)}
            onRefresh={refreshProject}
            onRegister={() => switchView("projects")}
            loading={loading}
          />
          <RequirementSelector
            requirements={requirements}
            selectedRequirementId={selectedRequirementId}
            onSelect={selectRequirement}
          />
        </div>
      </header>
      {error ? <div className="error-banner" role="alert">{error}</div> : null}
      {activeView !== "projects" ? <ProjectSummary project={selectedProject} requirements={requirements} board={board} /> : null}
      {renderMainContent()}
    </div>
  );
}
