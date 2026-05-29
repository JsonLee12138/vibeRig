import type { Evidence, TaskDetail } from "../app/types";
import { StatusBadge } from "../shared/StatusBadge";

export function AcceptanceMatrix({ detail }: { detail: TaskDetail }) {
  const evidenceByAcceptance = new Map<string, Evidence[]>();
  detail.evidence.forEach((item) => {
    if (!item.acceptance_item_id) return;
    const items = evidenceByAcceptance.get(item.acceptance_item_id) || [];
    items.push(item);
    evidenceByAcceptance.set(item.acceptance_item_id, items);
  });

  return (
    <section className="drawer-section">
      <h3>Acceptance Matrix</h3>
      <div className="matrix">
        <div className="matrix-head">Criteria</div>
        <div className="matrix-head">Result</div>
        <div className="matrix-head">Evidence</div>
        {detail.acceptance_items.map((item) => (
          <div className="matrix-row" key={item.id}>
            <div><strong>{item.acceptance_id}</strong><span>{item.title}</span></div>
            <StatusBadge value={item.status} />
            <span>{(evidenceByAcceptance.get(item.id) || []).length || detail.evidence.length} item(s)</span>
          </div>
        ))}
      </div>
    </section>
  );
}
