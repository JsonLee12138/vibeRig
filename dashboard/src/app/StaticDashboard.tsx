import type { DragEndEvent } from "@dnd-kit/core";
import type { ReactNode } from "react";
import type { DashboardSnapshot, TaskState, TaskSummary } from "./dashboard-model";
import type { Run, TaskDetail, TaskStatus } from "./types";
import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  CircleStop,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Grid2X2,
  GripVertical,
  HeartPulse,
  ListFilter,
  LoaderCircle,
  MoreHorizontal,
  Play,
  RefreshCw,
  Table2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "./api";
import { useDashboardSnapshot } from "./use-dashboard";

const navItems = [
  { key: "projects", labelKey: "nav.projects", to: "/projects" },
  { key: "requirements", labelKey: "nav.requirements", to: "/requirements" },
  { key: "inventory", labelKey: "nav.inventory", to: "/matrix" },
  { key: "insights", labelKey: "nav.insights", to: "/insights" },
] as const;

type NavKey = typeof navItems[number]["key"];

const stateTone: Record<TaskState, string> = {
  Backlog: "bg-[#f6f3f5] text-[#5f5e60] border-[#e4e2e4]",
  Ready: "bg-[#d7e3ff] text-[#004e9f] border-[#aac7ff]",
  Running: "bg-[#e8f2ff] text-[#0066cc] border-[#aac7ff]",
  Blocked: "bg-[#ffdad6] text-[#93000a] border-[#ffc4bd]",
  "Human Review": "bg-[#fff3d7] text-[#7a4b00] border-[#f4d38b]",
  Accepted: "bg-[#e7f6ed] text-[#027a48] border-[#b8e5c8]",
};

const boardStates: TaskState[] = ["Backlog", "Ready", "Running", "Blocked", "Human Review", "Accepted"];

const statusByState: Record<TaskState, TaskStatus> = {
  Accepted: "accepted",
  Backlog: "draft",
  Blocked: "blocked",
  "Human Review": "human_review",
  Ready: "ready",
  Running: "running",
};

function useSnapshot() {
  const query = useDashboardSnapshot();
  if (!query.data) {
    return null;
  }
  return query.data;
}

function downloadTextFile(filename: string, content: string, mimeType = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toRunLogLine(line: string, index: number) {
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
  } as const;
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function selectedProjectId(data: DashboardSnapshot | null) {
  if (typeof window !== "undefined") {
    const project = new URLSearchParams(window.location.search).get("project");
    if (project) return project;
  }
  return data?.projects[0]?.id || "";
}

function selectedRequirementId(data: DashboardSnapshot | null) {
  if (typeof window !== "undefined") {
    const requirement = new URLSearchParams(window.location.search).get("requirement");
    if (requirement) return requirement;
  }
  return data?.requirements[0]?.id || "";
}

function SyncProjectButton({ label }: { label: string }) {
  const data = useSnapshot();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const projectId = selectedProjectId(data);

  const syncProject = async () => {
    if (!projectId || syncing) return;
    setSyncing(true);
    try {
      await api.refreshProject(projectId);
      await queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <button className="vr-button" type="button" disabled={!projectId || syncing} onClick={() => void syncProject()}>
      <RefreshCw className={syncing ? "animate-spin" : ""} size={16} />
      {label}
    </button>
  );
}

export function AppShell({ activeNav, children, title, compact = false }: { activeNav?: NavKey; children: ReactNode; title: string; compact?: boolean }) {
  const location = useLocation();
  const showBackButton = location.pathname !== "/projects";
  return (
    <div className="min-h-screen bg-[#fcf8fb] text-[#1d1d1f]">
      <div className="relative bg-[#fcf8fb]">
        <div className="sticky top-0 bg-[#fcf8fb]">
          {!compact ? <TopBar activeNav={activeNav} title={title} /> : null}
          {!compact && showBackButton ? (
            <div className="mx-auto max-w-7xl px-4 pt-2 pb-4 sm:px-6 lg:px-8">
              <BackButton />
            </div>
          ) : null}
        </div>
        <main className={compact ? "" : "px-4 pb-8 pt-4 sm:px-6 lg:px-8"}>{children}</main>
      </div>
    </div>
  );
}

function BackButton({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: "/projects" });
  };

  return (
    <button className={`bg-transparent b-none px-0 hover:text-[#0066cc] ${className}`} type="button" aria-label={t("actions.back")} title={t("actions.back")} onClick={goBack}>
      <ArrowLeft size={20} />
    </button>
  );
}

function TopBar({ activeNav, title }: { activeNav?: NavKey; title: string }) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en";
  return (
    <header className="sticky top-0 z-10 border-b border-[#e4e2e4] bg-[#fcf8fb]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              {/*<div className="vr-kicker">{t("app.brand")}</div>*/}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#67686a]">
                {/*<span>{t("nav.projects")}</span>*/}
                <span className="vr-kicker">{t("app.brand")}</span>
                <ChevronRight size={14} />
                <span>E-commerce Backend</span>
                <ChevronRight size={14} />
                <strong className="text-[#1d1d1f]">{title}</strong>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link key={item.key} to={item.to} className={activeNav === item.key ? "vr-button-primary" : "vr-button"}>
                {t(item.labelKey)}
              </Link>
            ))}
            <label className="vr-button">
              <span className="sr-only">{t("language.label")}</span>
              <select
                aria-label={t("language.label")}
                className="border-0 bg-transparent text-sm outline-none"
                value={language}
                onChange={(event) => void i18n.changeLanguage(event.target.value)}
              >
                <option value="en">{t("language.english")}</option>
                <option value="zh">{t("language.simplifiedChinese")}</option>
              </select>
            </label>
            <SyncProjectButton label={t("actions.refreshProject")} />
            <Link to="/projects/register" className="vr-button-primary">{t("actions.registerProject")}</Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export function PageFrame({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section className="mx-auto grid max-w-7xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="vr-kicker">{t("app.workspace")}</p>
          <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">{title}</h1>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function ProjectSelectionPage() {
  const data = useSnapshot();
  const navigate = useNavigate();
  const { t } = useTranslation();
  if (!data) return <LoadingPage />;
  const selectProject = (projectId: string) => {
    void navigate({
      to: "/requirements",
      search: { project: projectId },
    });
  };

  return (
    <AppShell activeNav="projects" title={t("nav.projects")}>
      <PageFrame title={t("projects.selectTitle")}>
        <div className="grid gap-4 md:grid-cols-3">
          {data.projects.map((project) => (
            <article key={project.id} className="vr-panel grid min-h-58 gap-5 rounded-2 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="m-0 text-lg font-semibold">{project.name}</h2>
                  <p className="m-0 mt-1 text-sm text-[#67686a]">{project.repository}</p>
                </div>
                <StatusPill label={project.health} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Metric label={t("metrics.reqs")} value={project.requirements} />
                <Metric label={t("metrics.tasks")} value={project.tasks} />
                <Metric label={t("metrics.blockers")} value={project.blockers} danger={project.blockers > 0} />
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-[#e4e2e4] pt-4 text-sm text-[#67686a]">
                <span>{project.branch}</span>
                <button className="vr-button-primary" type="button" onClick={() => selectProject(project.id)}>{t("actions.select")}</button>
              </div>
            </article>
          ))}
        </div>
      </PageFrame>
    </AppShell>
  );
}

export function EmptyProjectPage() {
  const { t } = useTranslation();
  return (
    <AppShell activeNav="projects" title={t("nav.projects")}>
      <EmptyPanel title={t("projects.emptyTitle")} detail={t("projects.emptyDetail")} action={t("actions.learnMoreVibeRig")} icon={<ArrowRight size={18} />} />
    </AppShell>
  );
}

export function RegisterProjectPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const initializeProject = () => {
    void navigate({
      to: "/requirements",
      search: { project: "commerce-backend" },
    });
  };

  return (
    <AppShell activeNav="projects" title={t("nav.projects")}>
      <PageFrame title={t("projects.registerTitle")}>
        <form className="vr-panel mx-auto grid w-full max-w-2xl gap-5 rounded-2 p-6">
          {[
            [t("forms.projectName"), "E-commerce Backend"],
            [t("forms.repositoryUrl"), "https://github.com/acme/commerce-api"],
            [t("forms.branch"), "main"],
            [t("forms.requirementSource"), "Linear"],
            [t("forms.boardIdPath"), "requirements/authentication"],
          ].map(([label, value]) => (
            <label key={label} className="grid gap-2 text-sm font-medium">
              {label}
              <input defaultValue={value} className="h-11 rounded-2 border border-[#dcd9dc] bg-[#fcf8fb] px-3 text-sm font-normal outline-none focus:border-[#0066cc]" />
            </label>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Link className="vr-button" to="/projects">{t("actions.cancel")}</Link>
            <button className="vr-button-primary" type="button" onClick={initializeProject}>{t("actions.initializeProject")}</button>
          </div>
        </form>
      </PageFrame>
    </AppShell>
  );
}

export function RequirementSelectionPage() {
  const data = useSnapshot();
  const { t } = useTranslation();
  if (!data) return <LoadingPage />;
  return (
    <AppShell activeNav="requirements" title={t("nav.requirements")}>
      <PageFrame title={t("requirements.title")}>
        <div className="grid gap-4 lg:grid-cols-3">
          {data.requirements.map((requirement) => (
            <article key={requirement.id} className="vr-panel grid gap-4 rounded-2 p-5">
              <StatusPill label={requirement.status} />
              <div>
                <h2 className="m-0 text-lg font-semibold">{requirement.title}</h2>
                <p className="m-0 mt-2 text-sm text-[#67686a]">{requirement.source}</p>
              </div>
              <Progress value={requirement.acceptance} />
              <div className="flex items-center justify-between text-sm text-[#67686a]">
                <span>{t("requirements.mappedTasks", { count: requirement.tasks })}</span>
                <Link className="vr-button-primary" to="/board" search={{ requirement: requirement.id }}>{t("actions.openBoard")}</Link>
              </div>
            </article>
          ))}
        </div>
      </PageFrame>
    </AppShell>
  );
}

export function EmptyRequirementPage() {
  const { t } = useTranslation();
  return (
    <AppShell activeNav="requirements" title={t("nav.requirements")}>
      <EmptyPanel title={t("requirements.emptyTitle")} detail={t("requirements.emptyDetail")} action={t("actions.importRequirementBoard")} actionTo="/requirements" icon={<Upload size={18} />} secondary={t("actions.learnMoreBoardMapping")} secondaryTo="/matrix" />
    </AppShell>
  );
}

export function KanbanBoardPage({ invalidTransition = false }: { invalidTransition?: boolean }) {
  const data = useSnapshot();
  if (!data) return <LoadingPage />;

  return (
    <KanbanBoardContent
      key={data.tasks.map((task) => `${task.id}:${task.state}:${task.updatedAt}`).join("|")}
      initialTasks={data.tasks}
      invalidTransition={invalidTransition}
      projectId={selectedProjectId(data)}
      requirementId={selectedRequirementId(data)}
    />
  );
}

function KanbanBoardContent({ initialTasks, invalidTransition, projectId, requirementId }: { initialTasks: TaskSummary[]; invalidTransition: boolean; projectId: string; requirementId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const [tasks, setTasks] = useState<TaskSummary[]>(() => initialTasks);
  const [mutationError, setMutationError] = useState("");
  const tasksByState = useMemo(() => {
    return boardStates.reduce<Record<TaskState, TaskSummary[]>>((acc, state) => {
      acc[state] = tasks.filter((task) => task.state === state);
      return acc;
    }, {
      Accepted: [],
      Backlog: [],
      Blocked: [],
      "Human Review": [],
      Ready: [],
      Running: [],
    });
  }, [tasks]);

  const moveTask = (event: DragEndEvent) => {
    const overId = event.over?.id;
    if (!overId) {
      return;
    }
    const taskId = String(event.active.id);
    const previousTasks = tasks;
    const nextTasks = reorderTasks(tasks, taskId, String(overId), t("task.justNow"));
    const movedTask = nextTasks.find((task) => task.id === taskId);
    if (!movedTask || nextTasks === tasks || !projectId || !requirementId) {
      return;
    }
    setTasks(nextTasks);
    setMutationError("");

    const nextStatus = statusByState[movedTask.state];
    const previousTask = previousTasks.find((task) => task.id === taskId);
    const reason = nextStatus === "ready" && previousTask?.state !== "Backlog"
      ? "moved to ready from dashboard"
      : undefined;

    void (async () => {
      try {
        if (previousTask?.state !== movedTask.state) {
          await api.updateTaskStatus(projectId, requirementId, taskId, nextStatus, reason);
        }
        await api.updateTaskOrder(projectId, requirementId, nextTasks.map((task) => task.id));
        await queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
      } catch (error) {
        setTasks(previousTasks);
        setMutationError(error instanceof Error ? error.message : String(error));
      }
    })();
  };

  const startTask = (taskId: string) => {
    if (!projectId || !requirementId) return;
    const previousTasks = tasks;
    setTasks(tasks.map((task) => task.id === taskId ? { ...task, state: "Running", updatedAt: t("task.justNow") } : task));
    setMutationError("");
    void (async () => {
      try {
        await api.runTask(projectId, requirementId, taskId);
        await queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
      } catch (error) {
        setTasks(previousTasks);
        setMutationError(error instanceof Error ? error.message : String(error));
      }
    })();
  };

  return (
    <AppShell activeNav="requirements" title={t("board.title")}>
      <PageFrame
        title={t("board.title")}
        actions={(
          <>
            <SyncProjectButton label={t("actions.refreshBoard")} />
            <Link className="vr-button" to="/matrix"><Table2 size={16} />{t("matrix.title")}</Link>
          </>
        )}
      >
        {invalidTransition || mutationError ? <AlertBanner title={t("board.transitionBlocked")} detail={mutationError || t("board.transitionBlockedDetail")} /> : null}
        <DndContext sensors={sensors} onDragEnd={moveTask}>
          <div className="kanban-board-row">
            {boardStates.map((state) => (
              <KanbanColumn key={state} state={state} tasks={tasksByState[state]} onStartTask={startTask} />
            ))}
          </div>
        </DndContext>
      </PageFrame>
    </AppShell>
  );
}

function reorderTasks(tasks: TaskSummary[], activeTaskId: string, overId: string, updatedAt: string) {
  const activeTask = tasks.find((task) => task.id === activeTaskId);
  if (!activeTask) {
    return tasks;
  }

  const overTask = tasks.find((task) => task.id === overId);
  const nextState = overTask?.state ?? (boardStates.includes(overId as TaskState) ? overId as TaskState : null);
  if (!nextState) {
    return tasks;
  }

  const movedTask = { ...activeTask, state: nextState, updatedAt };
  const withoutActive = tasks.filter((task) => task.id !== activeTaskId);

  if (overTask && overTask.id !== activeTaskId) {
    const overIndex = withoutActive.findIndex((task) => task.id === overTask.id);
    if (overIndex >= 0) {
      return [
        ...withoutActive.slice(0, overIndex),
        movedTask,
        ...withoutActive.slice(overIndex),
      ];
    }
  }

  const lastInTargetStateIndex = withoutActive.reduce((lastIndex, task, index) => task.state === nextState ? index : lastIndex, -1);
  return [
    ...withoutActive.slice(0, lastInTargetStateIndex + 1),
    movedTask,
    ...withoutActive.slice(lastInTargetStateIndex + 1),
  ];
}

function KanbanColumn({ state, tasks, onStartTask }: { state: TaskState; tasks: TaskSummary[]; onStartTask: (taskId: string) => void }) {
  const { t } = useTranslation();
  const { isOver, setNodeRef } = useDroppable({ id: state });
  return (
    <section ref={setNodeRef} className={`kanban-column grid min-h-80 content-start gap-3 rounded-2 border p-3 transition-colors ${isOver ? "border-[#0066cc] bg-[#e8f2ff]" : "border-[#e4e2e4] bg-[#f6f3f5]"}`}>
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-sm font-semibold">{t(`status.${state}`)}</h2>
        <span className="rounded-full bg-white px-2 py-1 text-xs text-[#67686a]">{tasks.length}</span>
      </div>
      {tasks.map((task) => <TaskCard key={task.id} task={task} onStartTask={onStartTask} />)}
      {tasks.length === 0 ? <div className="grid min-h-24 place-items-center rounded-2 border border-dashed border-[#dcd9dc] text-xs text-[#67686a]">{t("board.dropTaskHere")}</div> : null}
    </section>
  );
}

function TaskCard({ task, onStartTask }: { task: TaskSummary; onStartTask: (taskId: string) => void }) {
  const { t } = useTranslation();
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  const { isOver, setNodeRef: setDropNodeRef } = useDroppable({ id: task.id });
  const style = transform
    ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    }
    : undefined;
  const setTaskNodeRef = (node: HTMLElement | null) => {
    setNodeRef(node);
    setDropNodeRef(node);
  };

  return (
    <article ref={setTaskNodeRef} className={`grid gap-3 rounded-2 border bg-white p-4 shadow-sm transition-shadow ${isDragging ? "z-20 opacity-75 shadow-lg" : ""} ${isOver && !isDragging ? "border-[#0066cc] ring-2 ring-[#aac7ff]" : "border-[#e4e2e4]"}`} style={style}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-[#0066cc]">
          <button {...attributes} {...listeners} type="button" aria-label={t("board.dragTask", { taskId: task.id })} className="grid size-7 cursor-grab place-items-center rounded-2 border border-[#e4e2e4] bg-[#fcf8fb] text-[#67686a] active:cursor-grabbing">
            <GripVertical size={14} />
          </button>
          {task.id}
        </span>
        <span className="rounded-full border border-[#e4e2e4] px-2 py-0.5 text-xs">{task.priority}</span>
      </div>
      <h3 className="m-0 text-sm font-semibold leading-5">{task.title}</h3>
      <Progress value={task.criteria} />
      <div className="flex items-center justify-between text-xs text-[#67686a]">
        <span>{t("task.evidenceCount", { count: task.evidence })}</span>
        <span>{task.latestRunStatus || task.updatedAt}</span>
      </div>
      {task.state === "Blocked" && task.reason ? <p className="m-0 rounded-2 border border-[#ffc4bd] bg-[#fff7f6] px-3 py-2 text-xs leading-5 text-[#93000a]">{task.reason}</p> : null}
      <div className="flex flex-wrap gap-2">
        {task.state === "Ready" ? (
          <button className="vr-button-primary" type="button" onClick={() => onStartTask(task.id)}>
            <Play size={16} />
            {t("actions.runTask")}
          </button>
        ) : null}
        <Link className="vr-button" to="/tasks/$taskId" params={{ taskId: task.id }}>{t("actions.open")}</Link>
        {task.state === "Running" ? <Link className="vr-button" to="/runs/$taskId/log" params={{ taskId: task.id }}>{t("actions.logs")}</Link> : null}
      </div>
    </article>
  );
}

export function AcceptanceMatrixPage() {
  const data = useSnapshot();
  const { t } = useTranslation();
  if (!data) return <LoadingPage />;
  const exportMatrix = () => {
    const header = [t("matrix.requirement"), t("matrix.taskId"), t("matrix.taskName"), t("matrix.status"), t("matrix.criteriaPercent"), t("matrix.evidence")].join(",");
    const rows = data.acceptance.map((row) => [row.requirement, row.taskId, row.taskName, row.status, row.criteria, row.evidence].map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(","));
    downloadTextFile("acceptance-matrix.csv", [header, ...rows].join("\n"), "text/csv;charset=utf-8");
  };

  return (
    <AppShell activeNav="inventory" title={t("nav.inventory")}>
      <PageFrame title={t("matrix.title")} actions={<><Link className="vr-button" to="/matrix" search={{ filter: "needs-evidence" }}><ListFilter size={16} />{t("actions.filter")}</Link><button className="vr-button" type="button" onClick={exportMatrix}><Download size={16} />{t("actions.export")}</button></>}>
        <div className="vr-panel overflow-hidden rounded-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-220 border-collapse text-left text-sm">
              <thead className="bg-[#f6f3f5] text-xs uppercase text-[#67686a]">
                <tr>{[t("matrix.requirement"), t("matrix.taskId"), t("matrix.taskName"), t("matrix.status"), t("matrix.criteriaPercent"), t("matrix.evidence")].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}</tr>
              </thead>
              <tbody>
                {data.acceptance.map((row) => (
                  <tr key={row.requirement} className="border-t border-[#e4e2e4]">
                    <td className="px-4 py-4 font-medium">{row.requirement}</td>
                    <td className="px-4 py-4"><Link className="text-[#0066cc]" to="/tasks/$taskId" params={{ taskId: row.taskId }}>{row.taskId}</Link></td>
                    <td className="px-4 py-4">{row.taskName}</td>
                    <td className="px-4 py-4"><StatusPill label={row.status} /></td>
                    <td className="px-4 py-4">{row.criteria}%</td>
                    <td className="px-4 py-4">{row.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}

export function InsightsPage() {
  const data = useSnapshot();
  const { t } = useTranslation();
  if (!data) return <LoadingPage />;
  return (
    <AppShell activeNav="insights" title={t("nav.insights")}>
      <PageFrame title={t("insights.title")}>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="vr-panel grid gap-5 rounded-2 p-5">
            <div className="flex items-center justify-between"><h2 className="m-0 flex items-center gap-2 text-lg"><HeartPulse size={20} />{t("insights.projectHealth")}</h2><MoreHorizontal size={20} /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label={t("insights.acceptanceReliability")} value="86%" />
              <Metric label={t("insights.velocityTrend")} value="+18%" />
              <Metric label={t("insights.openBlockers")} value="2" danger />
            </div>
            <div className="h-48 rounded-2 border border-[#e4e2e4] bg-[linear-gradient(180deg,#f6f3f5,#fff)] p-4">
              <div className="flex h-full items-end gap-3">
                {[40, 62, 58, 72, 86, 80, 92].map((height) => <div key={height} className="flex-1 rounded-t-2 bg-[#0066cc]" style={{ height: `${height}%` }} />)}
              </div>
            </div>
          </section>
          <section className="vr-panel grid content-start gap-4 rounded-2 p-5">
            <h2 className="m-0 flex items-center gap-2 text-lg"><AlertTriangle size={20} />{t("insights.blockerAnalysis")}</h2>
            {[t("insights.apiRateLimits"), t("insights.designAssetMissing"), t("insights.dataMigrationScript")].map((label, index) => (
              <div key={label} className="flex items-center justify-between rounded-2 border border-[#e4e2e4] p-4">
                <span className="font-medium">{label}</span>
                <StatusPill label={index === 0 ? "High" : "Medium"} />
              </div>
            ))}
            <Link className="vr-button justify-self-start" to="/board/invalid-transition">{t("actions.viewAllBlockers")} <ArrowRight size={16} /></Link>
          </section>
        </div>
      </PageFrame>
    </AppShell>
  );
}

export function ProjectRefreshPage() {
  const data = useSnapshot();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const projectId = selectedProjectId(data);

  useEffect(() => {
    if (!projectId) return;
    let active = true;

    async function refreshProject() {
      try {
        await api.refreshProject(projectId);
        await queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
        if (active) {
          void navigate({
            to: "/requirements",
            search: { project: projectId },
          });
        }
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      }
    }

    void refreshProject();
    return () => {
      active = false;
    };
  }, [navigate, projectId, queryClient]);

  return (
    <AppShell title={t("nav.projects")} compact>
      <div className="grid min-h-screen place-items-center px-4">
        <section className="vr-panel grid w-full max-w-xl gap-6 rounded-2 p-8 text-center">
          <Link className="vr-button justify-self-start" to="/board"><ArrowLeft size={16} />{t("actions.backToDashboard")}</Link>
          <LoaderCircle className="mx-auto animate-spin text-[#0066cc]" size={44} />
          <div>
            <h1 className="m-0 text-2xl font-semibold">{t("refresh.title")}</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#67686a]">{t("refresh.detail")}</p>
            {error ? <p className="mx-auto mt-3 max-w-md text-sm text-[#93000a]">{error}</p> : null}
          </div>
          <Link className="vr-button mx-auto" to="/projects"><CircleStop size={16} />{t("actions.cancelSync")}</Link>
        </section>
      </div>
    </AppShell>
  );
}

export function TaskDetailPage({ taskId = "AUTH-101", mode = "ready" }: { taskId?: string; mode?: "ready" | "blocked" | "accepted" | "running" | "review" }) {
  const data = useSnapshot();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [mutationError, setMutationError] = useState("");
  const [working, setWorking] = useState(false);
  if (!data) return <LoadingPage />;
  const task = data.tasks.find((item) => item.id === taskId) ?? data.tasks[0];
  const effectiveState = mode === "accepted" ? "Accepted" : mode === "blocked" ? "Blocked" : mode === "running" ? "Running" : task.state;
  const projectId = selectedProjectId(data);
  const requirementId = selectedRequirementId(data);

  const invalidateDashboard = async () => {
    await queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
  };

  const runTask = async () => {
    if (!projectId || !requirementId || !task?.id || working) return;
    setWorking(true);
    setMutationError("");
    try {
      if (task.state !== "Ready") {
        const reason = task.state === "Blocked" ? "rerun from dashboard" : undefined;
        await api.updateTaskStatus(projectId, requirementId, task.id, "ready", reason);
      }
      await api.runTask(projectId, requirementId, task.id);
      await invalidateDashboard();
      void navigate({ to: "/runs/$taskId/log", params: { taskId: task.id } });
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  };

  const stopTask = async () => {
    if (!projectId || !requirementId || !task?.id || working) return;
    setWorking(true);
    setMutationError("");
    try {
      await api.updateTaskStatus(projectId, requirementId, task.id, "blocked");
      await invalidateDashboard();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  };

  const submitManualReview = async (result: "accepted" | "rejected", notes = t("detail.reviewerFeedbackDefault")) => {
    if (!projectId || !requirementId || !task?.id || working) return;
    setWorking(true);
    setMutationError("");
    try {
      await api.recordManualReview(projectId, requirementId, task.id, "dashboard", result, notes, "", data.evidence.map((item) => item.path).filter(Boolean));
      await invalidateDashboard();
      void navigate({ to: "/tasks/$taskId", params: { taskId: task.id } });
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  };

  return (
    <AppShell activeNav="requirements" title={t("board.title")}>
      <PageFrame
        title={task.title}
        actions={(
          <>
            <button className={task.state === "Running" ? "vr-button" : "vr-button-primary"} type="button" disabled={working} onClick={() => void (task.state === "Running" ? stopTask() : runTask())}>{task.state === "Running" ? <CircleStop size={16} /> : <Play size={16} />}{task.state === "Running" ? t("actions.stopTask") : t("actions.runTask")}</button>
            <Link className="vr-button" to="/board"><X size={16} />{t("actions.close")}</Link>
          </>
        )}
      >
        {mutationError ? <AlertBanner title={t("board.transitionBlocked")} detail={mutationError} /> : null}
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="vr-panel grid gap-5 rounded-2 p-5">
            <div className="flex items-center gap-3"><StatusPill label={effectiveState} /><span className="text-sm text-[#67686a]">{task.id}</span></div>
            {effectiveState === "Blocked" && task.reason ? (
              <AlertBanner title={t("board.transitionBlocked")} detail={task.reason} />
            ) : null}
            <DetailSection title={t("detail.summary")}>{t("detail.summaryText")}</DetailSection>
            <DetailSection title={t("detail.scope")}><TagList values={[t("detail.tokenValidation"), t("detail.providerWiring"), t("detail.auditEvents"), t("detail.failureHandling")]} /></DetailSection>
            <DetailSection title={t("detail.dependencies")}><TagList values={taskId === "AUTH-105" ? ["AUTH-101", t("detail.smsProviderCredentials")] : [t("detail.userSchema"), t("detail.jwtLibrary")]} /></DetailSection>
          </section>
          <section className="vr-panel grid content-start gap-4 rounded-2 p-5">
            <h2 className="m-0 text-lg font-semibold">{t("detail.acceptanceCriteria")}</h2>
            {data.acceptance.slice(0, 3).map((item) => (
              <div key={item.requirement} className="grid gap-2 rounded-2 border border-[#e4e2e4] p-4">
                <div className="flex items-center justify-between gap-3"><span className="font-medium">{item.requirement}</span><StatusPill label={item.status} /></div>
                <Progress value={item.criteria} />
              </div>
            ))}
            {mode === "review" ? <ReviewPanel taskId={task.id} working={working} onSubmit={submitManualReview} /> : <EvidenceList data={data} />}
          </section>
        </div>
      </PageFrame>
    </AppShell>
  );
}

export function RunLogPage({ taskId = "AUTH-105" }: { taskId?: string }) {
  const data = useSnapshot();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const projectId = selectedProjectId(data);
  const requirementId = selectedRequirementId(data);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [runLog, setRunLog] = useState<DashboardSnapshot["runLog"]>([]);
  const [runError, setRunError] = useState("");
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (!projectId || !requirementId || !taskId) return;
    let canceled = false;
    let timeout: number | undefined;

    const load = async () => {
      try {
        const nextDetail = await api.task(projectId, requirementId, taskId);
        if (canceled) return;
        const latestRun = nextDetail.runs[0] || nextDetail.task.latest_run || null;
        setDetail(nextDetail);
        setRun(latestRun);
        setRunError("");
        if (latestRun?.id) {
          try {
            const log = await api.runLog(latestRun.id);
            if (!canceled) {
              setRunLog(log.split(/\r?\n/).filter(Boolean).map(toRunLogLine));
            }
          } catch (error) {
            if (!canceled) {
              setRunLog([]);
              setRunError(error instanceof Error ? error.message : String(error));
            }
          }
        } else {
          setRunLog([]);
        }
      } catch (error) {
        if (!canceled) {
          setRunError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!canceled) {
          timeout = window.setTimeout(load, 3000);
        }
      }
    };

    void load();
    return () => {
      canceled = true;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [projectId, requirementId, taskId]);

  if (!data) return <LoadingPage />;
  const task = detail?.task || data.tasks.find((item) => item.id === taskId);
  const taskBranch = detail?.task.branch || detail?.task.worktree_hint || task?.branch || "";
  const taskStatus = detail?.task.status || (task && "state" in task ? task.state : "");
  const codexSession = detail?.codex_sessions?.[0];
  const codexThreadId = run?.codex_thread_id || codexSession?.thread_id || "";
  const sessionId = codexThreadId || t("run.noCodexThread");
  const nativeSessionId = run?.codex_session_id || codexSession?.id || "";
  const apiServer = "/Users/jsonlee/Projects/vb-plugin/api/server.py";
  const runCommand = run?.id ? `python3 ${shellQuote(apiServer)} run-log ${shellQuote(run.id)}` : "";
  const sessionCommand = codexThreadId ? `codex resume --include-non-interactive --all ${shellQuote(codexThreadId)}` : "";
  const nativeSessionCommand = nativeSessionId ? `python3 ${shellQuote(apiServer)} codex-session ${shellQuote(nativeSessionId)}` : "";
  const logLines = runLog.length ? runLog : data.runLog;
  const isRunning = Boolean(run && !["success", "failed", "blocked", "canceled"].includes(run.status));
  const stopRun = async () => {
    if (!run?.id || stopping) return;
    setStopping(true);
    setRunError("");
    try {
      const canceledRun = await api.cancelRun(run.id);
      setRun(canceledRun);
      await queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error));
    } finally {
      setStopping(false);
    }
  };

  return (
    <AppShell title={t("board.title")} compact>
      <div className="grid min-h-screen grid-rows-[auto_auto_1fr] bg-[#f3f0f2]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dcd9dc] bg-white px-5 py-4">
          <div><p className="vr-kicker">{t("run.fullLogView")}</p><h1 className="m-0 mt-1 text-xl font-semibold">{t("run.title", { taskId })}</h1></div>
          <div className="flex gap-2"><button className="vr-button" type="button" disabled={!run?.id || stopping || !isRunning} onClick={() => void stopRun()}><CircleStop size={16} />{t("actions.stopRun")}</button></div>
        </header>
        <div className="px-5 py-3">
          <BackButton />
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
          <section className="max-h-[calc(100vh-152px)] overflow-y-auto overflow-x-hidden rounded-2 bg-[#1d1d1f] p-4 font-mono text-sm text-[#e8e8ea]">
            {logLines.length ? logLines.map((line) => <div key={`${line.time}-${line.message}`} className="grid grid-cols-[80px_60px_minmax(0,1fr)] gap-3 border-b border-white/8 py-2"><span className="text-[#727784]">{line.time}</span><span className={line.level === "error" ? "text-[#ffb4ab]" : line.level === "warn" ? "text-[#f4d38b]" : line.level === "ok" ? "text-[#9ce2b4]" : "text-[#aac7ff]"}>{line.level}</span><span className="min-w-0 break-words">{line.message}</span></div>) : <div className="py-2 text-[#aac7ff]">{runError || t("run.noLog")}</div>}
          </section>
          <section aria-label={t("run.runDetails")} className="grid content-start gap-4">
            {runError ? <AlertBanner title={t("board.transitionBlocked")} detail={runError} /> : null}
            <InfoBox
              title={t("run.metadata")}
              lines={[
                <CopyableMetaLine key="run-id" label={t("run.runId")} value={run?.id || "pending"} command={runCommand} />,
                <CopyableMetaLine key="session-id" label={t("run.sessionId")} value={sessionId || "pending"} command={sessionCommand} />,
                <CopyableMetaLine key="native-session-id" label={t("run.nativeSessionId")} value={nativeSessionId || "pending"} command={nativeSessionCommand} />,
                `${t("run.worker")}: ${run?.codex_adapter || "codex"}`,
                `${t("run.branch")}: ${taskBranch || run?.base_ref || "none"}`,
                `${t("run.status")}: ${run?.implementation_status || run?.status || taskStatus || "pending"}`,
              ]}
            />
            <InfoBox
              title={t("run.acceptanceCriteria")}
              lines={(detail?.acceptance_items || []).map((item) => `${item.acceptance_id}: ${item.title} [${item.status}]`).concat(detail?.acceptance_items.length ? [] : [t("run.noAcceptance")])}
            />
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function ReviewPanel({ taskId, working, onSubmit }: { taskId: string; working: boolean; onSubmit: (result: "accepted" | "rejected", notes?: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState(() => t("detail.reviewerFeedbackDefault"));
  return (
    <div className="grid gap-3 rounded-2 border border-[#e4e2e4] bg-[#fcf8fb] p-4">
      <Link className="vr-button justify-self-start" to="/runs/$taskId/log" params={{ taskId }}><ExternalLink size={16} />{t("actions.viewOriginalRunEvidence")}</Link>
      <label className="grid gap-2 text-sm font-medium">{t("detail.reviewerFeedback")}<textarea className="min-h-28 rounded-2 border border-[#dcd9dc] p-3 font-normal" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <div className="flex justify-end gap-2">
        <button className="vr-button" type="button" disabled={working} onClick={() => void onSubmit("rejected", notes)}>{t("actions.rejectWithFeedback")}</button>
        <button className="vr-button-primary" type="button" disabled={working} onClick={() => void onSubmit("accepted", notes)}>{t("actions.approveTask")}</button>
      </div>
    </div>
  );
}

function EvidenceList({ data }: { data: DashboardSnapshot }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-2">
      <h3 className="m-0 text-sm font-semibold">{t("task.recentEvidence")}</h3>
      {data.evidence.slice(0, 3).map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3 rounded-2 border border-[#e4e2e4] p-3 text-sm">
          <span className="flex items-center gap-2"><FileText size={16} />{item.label}</span>
          <StatusPill label={item.status} />
        </div>
      ))}
    </div>
  );
}

function EmptyPanel({ title, detail, action, actionTo = "/projects/register", secondary, secondaryTo, icon }: { title: string; detail: string; action: string; actionTo?: string; secondary?: string; secondaryTo?: string; icon: ReactNode }) {
  return (
    <section className="mx-auto grid min-h-[68vh] max-w-3xl place-items-center px-4">
      <div className="grid justify-items-center gap-5 text-center">
        <div className="grid size-16 place-items-center rounded-2 border border-[#d7e3ff] bg-[#dfe8ff] text-[#004e9f]"><Grid2X2 size={28} /></div>
        <div><h1 className="m-0 text-2xl font-semibold">{title}</h1><p className="mx-auto mt-2 max-w-lg text-[#67686a]">{detail}</p></div>
        <div className="flex flex-wrap justify-center gap-2"><Link className="vr-button-primary" to={actionTo}>{icon}{action}</Link>{secondary && secondaryTo ? <Link className="vr-button" to={secondaryTo}>{secondary}<ExternalLink size={16} /></Link> : null}</div>
      </div>
    </section>
  );
}

function LoadingPage() {
  const { t } = useTranslation();
  return <div className="grid min-h-screen place-items-center bg-[#fcf8fb] text-[#67686a]">{t("app.loading")}</div>;
}

function AlertBanner({ title, detail }: { title: string; detail: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2 border border-[#ffc4bd] bg-[#ffdad6] p-4 text-[#93000a]">
      <span className="flex items-center gap-2 font-semibold"><AlertTriangle size={18} />{title}</span>
      <span className="text-sm">{detail}</span>
      <Link className="vr-button bg-white" to="/tasks/$taskId/blocked" params={{ taskId: "AUTH-105" }}>{t("actions.gotIt")}</Link>
    </div>
  );
}

function Metric({ label, value, danger }: { label: string; value: ReactNode; danger?: boolean }) {
  return <div className="rounded-2 border border-[#e4e2e4] bg-[#fcf8fb] p-3"><div className={`text-2xl font-semibold ${danger ? "text-[#ba1a1a]" : ""}`}>{value}</div><div className="mt-1 text-xs text-[#67686a]">{label}</div></div>;
}

function StatusPill({ label }: { label: string }) {
  const { t } = useTranslation();
  const tone = (["Backlog", "Ready", "Running", "Blocked", "Human Review", "Accepted"] as string[]).includes(label) ? stateTone[label as TaskState] : label === "High" ? "bg-[#ffdad6] text-[#93000a] border-[#ffc4bd]" : "bg-[#f6f3f5] text-[#5f5e60] border-[#e4e2e4]";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{t(`status.${label}`, { defaultValue: label })}</span>;
}

function Progress({ value }: { value: number }) {
  return <div className="h-2 overflow-hidden rounded-full bg-[#e4e2e4]"><div className="h-full rounded-full bg-[#0066cc]" style={{ width: `${value}%` }} /></div>;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="grid gap-2"><h2 className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[#67686a]">{title}</h2><div className="text-sm leading-6">{children}</div></section>;
}

function TagList({ values }: { values: string[] }) {
  return <div className="flex flex-wrap gap-2">{values.map((value) => <span key={value} className="rounded-full border border-[#e4e2e4] bg-[#f6f3f5] px-3 py-1 text-xs">{value}</span>)}</div>;
}

function CopyableMetaLine({ command, label, value }: { command?: string; label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();
  const copyCommand = async () => {
    if (!command) return;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(command);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = command;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      className="grid w-full gap-1 rounded-2 border border-[#e4e2e4] bg-white px-3 py-2 text-left text-[#1d1d1f] hover:border-[#aac7ff] hover:bg-[#f8fbff] disabled:cursor-default disabled:opacity-60"
      type="button"
      disabled={!command}
      title={command || undefined}
      onClick={() => void copyCommand()}
    >
      <span className="flex items-center justify-between gap-2 text-xs font-semibold uppercase text-[#67686a]">
        <span>{label}</span>
        {command ? <span className="inline-flex items-center gap-1 normal-case text-[#0066cc]">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t("actions.copied") : t("actions.copyCommand")}</span> : null}
      </span>
      <code className="whitespace-normal break-all font-mono text-xs leading-5 text-[#1d1d1f]">{value}</code>
    </button>
  );
}

function InfoBox({ title, lines }: { title: string; lines: ReactNode[] }) {
  return <section className="vr-panel rounded-2 p-4"><h2 className="m-0 text-base font-semibold">{title}</h2><div className="mt-3 grid gap-2 text-sm text-[#67686a]">{lines.map((line, index) => <span key={typeof line === "string" ? line : index}>{line}</span>)}</div></section>;
}
