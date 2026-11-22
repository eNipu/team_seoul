import { DEMO_PLATFORM_LABELS, type DemoPlatform } from "../types";
import { type Action, type Nav } from "./common";
import { Icon } from "./icons";

const PLATFORMS: DemoPlatform[] = ["instagram", "linkedin"];

export default function DemoImport({ nav, action, disabled = false }: { nav: Nav; action: Action; disabled?: boolean }) {
  return (
    <details className="demo-import">
      <summary>Preview profiles</summary>
      <div className="demo-import__body">
        <p className="muted small">These previews use built-in profiles, not a connected account or an uploaded export.</p>
        <div className="demo-import__actions">
          {PLATFORMS.map((platform) => (
            <button
              key={platform}
              type="button"
              className="btn"
              disabled={disabled || action.busy !== null}
              onClick={() => void action.run(`demo:${platform}`, () => nav.openView("venn_preview_demo_people_import", { platform }))}
            >
              <Icon name="import" size={18} />
              {action.busy === `demo:${platform}` ? "Opening…" : `${DEMO_PLATFORM_LABELS[platform]} import`}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}
