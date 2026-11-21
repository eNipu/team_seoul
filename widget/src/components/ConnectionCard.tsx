import type { Connection } from "../types";
import { formatDate } from "../types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export default function ConnectionCard({ connection }: { connection: Connection }) {
  return (
    <li className="card connection-card">
      <span className="avatar" aria-hidden="true">{initials(connection.display_name)}</span>
      <div className="connection-card__body">
        <strong>{connection.display_name}</strong>
        <span className="muted small">
          {connection.since ? `Connected ${formatDate(connection.since)}` : "Connected"}
          {connection.last_interaction_at ? ` · Last chat ${formatDate(connection.last_interaction_at)}` : ""}
        </span>
      </div>
    </li>
  );
}
