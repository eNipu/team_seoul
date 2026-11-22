import { DEMO_PLATFORM_LABELS, type DashboardViewData, type HelpViewData, type WelcomeViewData } from "../types";
import { ActionError, useAction, type Nav } from "./common";
import { Icon } from "./icons";

type SetupData = DashboardViewData | HelpViewData | WelcomeViewData;
const titles = ["Import memories", "Add your people", "Find connections with similar interests"];
const descriptions = [
  "Choose which interests to preview in chat. Only the memories you select and approve are saved.",
  "Start with Instagram or LinkedIn. You’ll review generated profiles, not contacts from your account. Pick who to add, then continue or try the other source.",
  "Compare your saved interests with your circle. Looking at a match doesn’t contact anyone.",
];

export default function SetupCard({ data, nav }: { data: SetupData; nav: Nav }) {
  const action = useAction();
  const progress = data.onboarding;
  const current = [progress?.memories_ready, progress?.contacts_ready, progress?.matches_reviewed].findIndex((ready) => ready !== true);
  if (current < 0) return data.view === "welcome" ? (
    <section className="panel"><h2>You’re all set</h2><p className="muted">Ask Venn about the interests you share with someone in your circle.</p></section>
  ) : null;
  if (!progress && data.view !== "welcome") return null;

  function openStep() {
    void action.run("open", () => {
      if (current === 0) return nav.openView("venn_import_chatgpt_memory", {});
      return nav.openView("venn_find_interest_matches", {});
    });
  }

  return (
    <section className="setup" aria-labelledby="setup-title">
      <header className="setup__head-text">
        <p className="small muted">Getting started · Step {current + 1} of 3</p>
        <h2 className="setup__title" id="setup-title">Find common ground in your circle</h2>
        <p className="small muted">This guide is optional. You can keep using Venn in chat without importing anything.</p>
      </header>
      <ol className="setup-steps setup-steps--path">
        {titles.map((title, i) => (
          <li key={title} className={`setup-step ${i === current ? "setup-step--current" : i < current ? "setup-step--done" : ""}`} aria-current={i === current ? "step" : undefined}>
            <span className="setup-step__marker" aria-hidden="true">{i < current ? <Icon name="check" size={16} /> : i + 1}</span>
            <div className="setup-step__body">
              <h3 className="setup-step__title">{title}</h3>
              {i !== current ? <p className="muted small">{i < current ? "Complete" : `Locked until step ${i} is complete`}</p> : <>
                <p className="muted small">{descriptions[i]}</p>
                {i === 1 ? (
                  <div className="setup-step__platforms" role="group" aria-label="Choose a profile source">
                    {(["instagram", "linkedin"] as const).map((platform) => (
                      <button key={platform} type="button" className="btn" disabled={action.busy !== null}
                        onClick={() => void action.run(platform, () => nav.openView("venn_preview_demo_people_import", { platform }))}>
                        <Icon name="import" size={18} />
                        {action.busy === platform ? `Opening ${DEMO_PLATFORM_LABELS[platform]}…` : `${DEMO_PLATFORM_LABELS[platform]} import`}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="setup-step__actions"><button className="btn btn--primary" type="button" disabled={action.busy !== null} onClick={openStep}>
                    {action.busy ? "Opening…" : i === 0 ? "Choose memory areas" : "Find matches"}
                  </button></div>
                )}
                <ActionError action={action} />
                {action.failure && <p className="muted small">Or ask in chat: “{["Open Venn’s memory import", "Help me add people from Instagram or LinkedIn", "Find connections with similar interests in Venn"][i]}.”</p>}
              </>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
