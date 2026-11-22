import { DEMO_PLATFORM_LABELS } from "../types";
import type { Action, Nav } from "./common";
import { Icon } from "./icons";

export default function ContactImportSources({ action, nav, replace = false }: { action: Action; nav: Nav; replace?: boolean }) {
  const open = replace ? nav.replaceView : nav.openView;
  return (
    <div className="contact-import-sources">
      <p className="muted small">Import sample contacts from Instagram or LinkedIn.</p>
      <div className="button-row" role="group" aria-label="Choose a contact source">
        {(["instagram", "linkedin"] as const).map((platform) => (
          <button key={platform} type="button" className="btn" disabled={action.busy !== null}
            onClick={() => void action.run(platform, () => open("venn_preview_demo_people_import", { platform }))}>
            <Icon name="import" size={18} />
            {action.busy === platform ? `Opening ${DEMO_PLATFORM_LABELS[platform]}…` : `${DEMO_PLATFORM_LABELS[platform]} import`}
          </button>
        ))}
      </div>
    </div>
  );
}
