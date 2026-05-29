import { RefreshCw, FolderPlus } from "lucide-react";
import type { Project } from "../app/types";
import { EmptyState } from "../shared/EmptyState";
import { StatusBadge } from "../shared/StatusBadge";
import { ToolbarButton } from "../shared/ToolbarButton";

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string;
  onSelect: (projectId: string) => void;
  onRefresh: () => void;
  onRegister: () => void;
  loading?: boolean;
}

export function ProjectSelector({
  projects,
  selectedProjectId,
  onSelect,
  onRefresh,
  onRegister,
  loading,
}: ProjectSelectorProps) {
  if (!projects.length) {
    return (
      <EmptyState
        title="No projects registered"
        detail="Register a project root to load VibeRig requirements."
        action={<ToolbarButton icon={<FolderPlus size={16} />} label="Register" onClick={onRegister} />}
      />
    );
  }

  const selected = projects.find((project) => project.id === selectedProjectId);

  return (
    <section className="selector-panel selector-panel-project">
      <div className="selector-heading">
        <span className="selector-kicker">Workspace</span>
        <span className="selector-hint">{projects.length} connected</span>
      </div>
      <div className="selector-controls">
        <label className="selector-field">
          <span>Project</span>
          <select value={selectedProjectId} onChange={(event) => onSelect(event.target.value)}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name || project.id}
              </option>
            ))}
          </select>
        </label>
        <div className="selector-actions">
          <ToolbarButton
            icon={<RefreshCw size={16} />}
            label={loading ? "Syncing" : "Sync Project"}
            onClick={onRefresh}
            disabled={loading}
          />
          <ToolbarButton icon={<FolderPlus size={16} />} label="Register Project" onClick={onRegister} />
        </div>
      </div>
      {selected ? (
        <div className="selector-meta">
          <StatusBadge value={selected.status || "registered"} />
          <code title={selected.project_root}>{selected.project_root}</code>
        </div>
      ) : null}
    </section>
  );
}
