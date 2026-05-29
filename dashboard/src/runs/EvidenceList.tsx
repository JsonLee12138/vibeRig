import { Copy } from "lucide-react";
import type { Evidence } from "../app/types";

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  return (
    <section className="drawer-section">
      <h3>Evidence</h3>
      {evidence.length ? (
        <ul className="evidence-list">
          {evidence.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.kind}</strong>
                <span>{item.summary || "recorded evidence"}</span>
                {item.path ? <code>{item.path}</code> : null}
              </div>
              {item.path ? <button title="Copy path" onClick={() => navigator.clipboard.writeText(item.path || "")}><Copy size={15} /></button> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No evidence recorded.</p>
      )}
    </section>
  );
}
