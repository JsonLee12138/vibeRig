import type { ActivityEvent } from "../app/types";

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  return (
    <section className="drawer-section">
      <h3>Activity</h3>
      {events.length ? (
        <ol className="timeline">
          {events.map((event, index) => (
            <li key={`${event.event_type}-${event.created_at}-${index}`}>
              <strong>{event.event_type}</strong>
              <span>{event.created_at || ""}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No activity recorded.</p>
      )}
    </section>
  );
}
