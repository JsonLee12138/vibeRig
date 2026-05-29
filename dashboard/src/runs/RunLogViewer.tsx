import { useEffect, useState } from "react";
import { api } from "../app/api";

export function RunLogViewer({ runId }: { runId?: string }) {
  const [log, setLog] = useState("");

  useEffect(() => {
    if (!runId) {
      setLog("");
      return;
    }
    let active = true;
    const load = async () => {
      const next = await api.runLog(runId);
      if (active) setLog(next || "");
    };
    load().catch(() => setLog(""));
    const timer = window.setInterval(() => load().catch(() => undefined), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [runId]);

  return <pre className="run-log">{log || "No log selected."}</pre>;
}
