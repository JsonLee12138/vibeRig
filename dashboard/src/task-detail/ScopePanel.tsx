import type { Task } from "../app/types";

export function ScopePanel({ task }: { task: Task }) {
  const include = task.scope?.include || [];
  const exclude = task.scope?.exclude || [];
  return (
    <section className="drawer-section">
      <h3>Scope</h3>
      <div className="two-col">
        <div>
          <strong>Include</strong>
          <ul>{include.length ? include.map((item) => <li key={item}><code>{item}</code></li>) : <li>none</li>}</ul>
        </div>
        <div>
          <strong>Exclude</strong>
          <ul>{exclude.length ? exclude.map((item) => <li key={item}><code>{item}</code></li>) : <li>none</li>}</ul>
        </div>
      </div>
    </section>
  );
}
