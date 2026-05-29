import type { AcceptanceItem } from "../app/types";
import { StatusBadge } from "../shared/StatusBadge";

interface AcceptanceChecklistProps {
  items: AcceptanceItem[];
  onUpdateStatus: (acceptanceId: string, status: string) => void;
}

export function AcceptanceChecklist({ items, onUpdateStatus }: AcceptanceChecklistProps) {
  return (
    <section className="drawer-section">
      <h3>Acceptance Checklist</h3>
      {items.length ? (
        <ul className="acceptance-list">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.acceptance_id}</strong>
                <span>{item.title}</span>
              </div>
              <StatusBadge value={item.status} />
              <select value={item.status} onChange={(event) => onUpdateStatus(item.acceptance_id, event.target.value)}>
                {["pending", "passed", "failed", "partial", "blocked", "waived"].map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No linked acceptance criteria.</p>
      )}
    </section>
  );
}
