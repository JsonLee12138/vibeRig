import type { Requirement } from "../app/types";
import { EmptyState } from "../shared/EmptyState";
import { StatusBadge } from "../shared/StatusBadge";

interface RequirementSelectorProps {
  requirements: Requirement[];
  selectedRequirementId: string;
  onSelect: (requirementId: string) => void;
}

export function RequirementSelector({ requirements, selectedRequirementId, onSelect }: RequirementSelectorProps) {
  if (!requirements.length) {
    return <EmptyState title="No imported requirements" detail="Refresh the project after adding .vibeRig requirements." />;
  }

  return (
    <section className="selector-panel selector-panel-requirement">
      <div className="selector-heading">
        <span className="selector-kicker">Requirement</span>
        <span className="selector-hint">{requirements.length} available</span>
      </div>
      <div className="selector-controls">
        <label className="selector-field">
          <span>Selection</span>
          <select value={selectedRequirementId} onChange={(event) => onSelect(event.target.value)}>
            {requirements.map((requirement) => (
              <option key={requirement.requirement_id} value={requirement.requirement_id}>
                {requirement.requirement_id} · {requirement.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="requirement-list" aria-label="Requirement list">
        {requirements.map((requirement) => (
          <button
            key={requirement.requirement_id}
            className={requirement.requirement_id === selectedRequirementId ? "requirement-pill active" : "requirement-pill"}
            onClick={() => onSelect(requirement.requirement_id)}
          >
            <strong>{requirement.requirement_id}</strong>
            <span>{requirement.title}</span>
            <StatusBadge value={requirement.status || "imported"} />
          </button>
        ))}
      </div>
    </section>
  );
}
