import { FolderPlus, RefreshCw } from "lucide-react";
import type { Board, Project, Requirement } from "../app/types";
import { EmptyState } from "../shared/EmptyState";
import { StatusBadge } from "../shared/StatusBadge";
import { ToolbarButton } from "../shared/ToolbarButton";

interface ProjectGalleryProps {
  board?: Board | null;
  loading?: boolean;
  projectRoot: string;
  projects: Project[];
  requirements: Requirement[];
  selectedProjectId: string;
  onChangeProjectRoot: (value: string) => void;
  onOpenBoard: (projectId: string) => void;
  onRefreshProject: () => void;
  onRegisterProject: () => void;
  onSelectProject: (projectId: string) => void;
}

function formatTimestamp(value?: string) {
  if (!value) return "Not refreshed yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function ProjectGallery({
  board,
  loading,
  projectRoot,
  projects,
  requirements,
  selectedProjectId,
  onChangeProjectRoot,
  onOpenBoard,
  onRefreshProject,
  onRegisterProject,
  onSelectProject,
}: ProjectGalleryProps) {
  if (!projects.length) {
    return (
      <section className="page-shell">
        <EmptyState
          title="No projects registered yet."
          detail="Connect your first repository to track requirements, automate acceptance criteria, and unlock the VibeRig dashboard."
          action={
            <div className="register-form">
              <label className="register-field">
                <span>Project root</span>
                <input
                  placeholder="/Users/you/Projects/example"
                  value={projectRoot}
                  onChange={(event) => onChangeProjectRoot(event.target.value)}
                />
              </label>
              <div className="page-actions">
                <ToolbarButton icon={<FolderPlus size={16} />} label="Register Project" variant="primary" onClick={onRegisterProject} />
              </div>
            </div>
          }
        />
      </section>
    );
  }

  return (
    <section className="page-shell">
      <div className="page-hero">
        <div>
          <p className="eyebrow">Project Selection</p>
          <h1>Select a project to begin</h1>
          <p className="page-copy">
            Choose an active workspace or register a new repository to start managing requirements, runs, acceptance evidence, and human review.
          </p>
        </div>
        <div className="page-actions">
          <ToolbarButton icon={<RefreshCw size={16} />} label={loading ? "Syncing" : "Sync Selected"} onClick={onRefreshProject} disabled={!selectedProjectId || loading} />
          <ToolbarButton icon={<FolderPlus size={16} />} label="Register Project" variant="primary" onClick={onRegisterProject} />
        </div>
      </div>

      <div className="project-gallery">
        {projects.map((project) => {
          const isSelected = project.id === selectedProjectId;
          const statusCount = isSelected && board
            ? {
                running: board.tasks.filter((task) => task.status === "running").length,
                blocked: board.tasks.filter((task) => task.status === "blocked").length,
                failed: board.tasks.filter((task) => task.status === "failed").length,
              }
            : null;

          return (
            <article key={project.id} className={isSelected ? "project-card project-card-selected" : "project-card"}>
              <div className="project-card-header">
                <div>
                  <p className="project-card-title">{project.name || project.id}</p>
                  <code>{project.project_root}</code>
                </div>
                <StatusBadge value={project.status || "registered"} />
              </div>

              <div className="project-card-metrics">
                <div>
                  <span>Requirements</span>
                  <strong>{isSelected ? requirements.length : "Open"}</strong>
                </div>
                <div>
                  <span>Running</span>
                  <strong>{statusCount ? statusCount.running : "..."}</strong>
                </div>
                <div>
                  <span>Blocked</span>
                  <strong>{statusCount ? statusCount.blocked : "..."}</strong>
                </div>
                <div>
                  <span>Failed</span>
                  <strong>{statusCount ? statusCount.failed : "..."}</strong>
                </div>
              </div>

              <div className="project-card-footer">
                <span>{formatTimestamp(project.updated_at)}</span>
                <div className="page-actions">
                  <ToolbarButton label={isSelected ? "Current Project" : "Select"} onClick={() => onSelectProject(project.id)} />
                  <ToolbarButton label="Open Board" variant="primary" onClick={() => onOpenBoard(project.id)} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="register-panel">
        <div>
          <p className="eyebrow">Register Project</p>
          <h2>Connect another repository</h2>
        </div>
        <div className="register-form">
          <label className="register-field">
            <span>Project root</span>
            <input
              placeholder="/Users/you/Projects/example"
              value={projectRoot}
              onChange={(event) => onChangeProjectRoot(event.target.value)}
            />
          </label>
          <ToolbarButton icon={<FolderPlus size={16} />} label="Register Project" variant="primary" onClick={onRegisterProject} />
        </div>
      </section>
    </section>
  );
}
