export type TaskStatus =
  | "draft"
  | "ready"
  | "running"
  | "self_accepted"
  | "human_review"
  | "accepted"
  | "blocked"
  | "failed"
  | "canceled";

export type ReviewResult = "accepted" | "rejected";

export interface Project {
  id: string;
  name: string;
  project_root: string;
  status?: string;
  config_path?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Requirement {
  id?: string;
  project_id: string;
  requirement_id: string;
  title: string;
  status?: string;
  source_path?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SourceRevision {
  source_name: string;
  path: string;
  sha256: string;
  updated_at: string;
}

export interface RoadmapItem {
  id: string;
  roadmap_id: string;
  title: string;
  status?: string;
  sort_order?: number;
}

export interface Task {
  id: string;
  project_id: string;
  requirement_id: string;
  task_id: string;
  title: string;
  type?: string;
  status: TaskStatus;
  priority: number;
  sort_order: number;
  roadmap_id?: string;
  suggested_agent?: string;
  acceptance_agent?: string;
  review_agent?: string;
  branch?: string;
  worktree_hint?: string;
  scope?: { include?: string[]; exclude?: string[] };
  validation?: unknown[];
  review?: Record<string, unknown>;
  source?: Record<string, unknown>;
  definition_hash?: string;
  definition_stale?: boolean;
  definition_changed_at?: string | null;
  evidence_count?: number;
  status_reason?: string | null;
  blocked_reason?: string | null;
  latest_run?: Run | null;
  manual_review?: ManualReview | null;
  acceptance_progress?: { completed: number; total: number };
  created_at?: string;
  updated_at?: string;
}

export interface TaskDependency {
  task_id: string;
  depends_on_task_id: string;
  waived?: number | boolean;
}

export interface AcceptanceItem {
  id: string;
  project_id: string;
  requirement_id: string;
  acceptance_id: string;
  title: string;
  status: string;
  evidence_required?: number | boolean;
  source_json?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TaskAcceptanceLink {
  task_id: string;
  acceptance_item_id: string;
}

export interface Run {
  id: string;
  project_id: string;
  requirement_id?: string;
  task_id?: string;
  status: string;
  implementation_status?: string;
  codex_adapter?: string;
  codex_session_id?: string;
  codex_thread_id?: string;
  codex_conversation_id?: string;
  codex_exit_code?: number;
  codex_usage?: Record<string, unknown>;
  changed_files?: string[];
  diff_path?: string;
  error_summary?: string;
  base_ref?: string;
  base_sha?: string;
  source_sha?: string;
  worktree_path?: string;
  run_db_path?: string;
  started_at?: string;
  finished_at?: string;
  summary?: string;
}

export interface CodexSession {
  id: string;
  project_id?: string;
  requirement_id?: string;
  task_id?: string;
  run_id?: string;
  adapter?: string;
  status?: string;
  native_session_id?: string;
  thread_id?: string;
  conversation_id?: string;
  prompt_path?: string;
  transcript_path?: string;
  events_path?: string;
  final_message_path?: string;
  started_at?: string;
  finished_at?: string;
}

export interface RunDetail {
  run: Run;
  codex_session?: CodexSession | null;
  artifacts?: {
    paths?: Record<string, string | null>;
    exists?: Record<string, boolean>;
    changed_files?: string[];
  };
}

export interface Evidence {
  id: string;
  project_id: string;
  requirement_id: string;
  task_id?: string;
  acceptance_item_id?: string;
  kind: string;
  path?: string;
  summary?: string;
  payload_json?: string;
  recorded_at?: string;
}

export interface ManualReview {
  id?: string;
  project_id?: string;
  requirement_id?: string;
  task_id?: string;
  reviewer: string;
  result: ReviewResult | string;
  notes?: string;
  evidence_reviewed_json?: string;
  residual_risks?: string;
  created_at?: string;
}

export interface ActivityEvent {
  id?: string;
  event_type: string;
  project_id?: string;
  requirement_id?: string;
  task_id?: string;
  payload_json?: string;
  created_at?: string;
}

export interface BoardColumn {
  status: TaskStatus;
  title: string;
  tasks: Task[];
}

export interface Board {
  requirement: Requirement;
  columns: BoardColumn[];
  tasks: Task[];
  dependencies: TaskDependency[];
  acceptance_items: AcceptanceItem[];
  task_acceptance_links: TaskAcceptanceLink[];
}

export interface TaskDetail {
  task: Task;
  dependencies: Task[];
  acceptance_items: AcceptanceItem[];
  runs: Run[];
  codex_sessions?: CodexSession[];
  evidence: Evidence[];
  manual_reviews: ManualReview[];
  activity: ActivityEvent[];
}
