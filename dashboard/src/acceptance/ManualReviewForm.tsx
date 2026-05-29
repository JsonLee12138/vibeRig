import { Check, X } from "lucide-react";
import { useState } from "react";
import type { Evidence, ReviewResult } from "../app/types";
import { ToolbarButton } from "../shared/ToolbarButton";

interface ManualReviewFormProps {
  evidence: Evidence[];
  onSubmit: (reviewer: string, result: ReviewResult, notes: string, residualRisks: string, evidenceReviewed: string[]) => void;
}

export function ManualReviewForm({ evidence, onSubmit }: ManualReviewFormProps) {
  const [reviewer, setReviewer] = useState("human");
  const [notes, setNotes] = useState("");
  const [residualRisks, setResidualRisks] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);

  const toggleEvidence = (id: string) => {
    setSelectedEvidence((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const submit = (result: ReviewResult) => onSubmit(reviewer, result, notes, residualRisks, selectedEvidence);

  return (
    <section className="drawer-section">
      <h3>Manual Review</h3>
      <label>Reviewer<input value={reviewer} onChange={(event) => setReviewer(event.target.value)} /></label>
      <label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <label>Residual risks<textarea value={residualRisks} onChange={(event) => setResidualRisks(event.target.value)} /></label>
      <div className="evidence-checks">
        {evidence.map((item) => (
          <label key={item.id}>
            <input type="checkbox" checked={selectedEvidence.includes(item.id)} onChange={() => toggleEvidence(item.id)} />
            {item.kind}
          </label>
        ))}
      </div>
      <div className="row-actions">
        <ToolbarButton icon={<Check size={15} />} label="Accept" variant="primary" onClick={() => submit("accepted")} />
        <ToolbarButton icon={<X size={15} />} label="Reject" variant="danger" onClick={() => submit("rejected")} />
      </div>
    </section>
  );
}
