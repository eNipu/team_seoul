import { useState } from "react";
import type { DashboardViewData, HelpViewData, WelcomeViewData } from "../types";
import { ActionError, useAction, type Nav } from "./common";
import { Icon } from "./icons";

type SetupData = DashboardViewData | HelpViewData | WelcomeViewData;
const titles = ["Import memories", "Import contacts", "Find connections with similar interests"];
const descriptions = [
  "Choose which interests to preview in chat. Only the memories you select and approve are saved.",
  "Choose Instagram or LinkedIn. Review built-in profiles or bring your own contact list. One source is enough; nothing is added until you confirm.",
  "Compare your saved interests with your circle. Looking at a match doesn’t contact anyone.",
];

export default function SetupCard({ data, nav }: { data: SetupData; nav: Nav }) {
  const action = useAction();
  const [platform, setPlatform] = useState<"instagram" | "linkedin">("instagram");
  const progress = data.onboarding;
  const current = [progress?.memories_ready, progress?.contacts_ready, progress?.matches_reviewed].findIndex((ready) => ready !== true);
  if (current < 0) return data.view === "welcome" ? (
    <section className="panel"><h2>You’re all set</h2><p className="muted">Ask Venn about the interests you share with someone in your circle.</p></section>
  ) : null;
  if (!progress && data.view !== "welcome") return null;

  const platformName = platform === "instagram" ? "Instagram" : "LinkedIn";
  const labels = ["Choose memory areas", `Preview ${platformName} profiles`, "Find matches"];
  function openStep() {
    void action.run("open", () => {
      if (current === 0) return nav.openView("venn_import_chatgpt_memory", {});
      if (current === 1) return nav.openView("venn_preview_demo_people_import", { platform });
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
                {i === 1 && <fieldset className="goal-picker" disabled={action.busy !== null}>
                  <legend className="sr-only">Profile source</legend>
                  <div className="chips">{(["instagram", "linkedin"] as const).map((source) => (
                    <button key={source} type="button" className={`btn ${source === platform ? "chip--on" : ""}`} aria-pressed={source === platform} onClick={() => { action.clear(); setPlatform(source); }}>
                      {source === platform && <Icon name="check" size={16} />}{source === "instagram" ? "Instagram" : "LinkedIn"}
                    </button>
                  ))}</div>
                </fieldset>}
                <div className="setup-step__actions"><button className="btn btn--primary" type="button" disabled={action.busy !== null} onClick={openStep}>
                  {action.busy ? "Opening…" : labels[i]}
                </button></div>
                <ActionError action={action} />
                {action.failure && <p className="muted small">Or ask in chat: “{["Open Venn’s memory import", `Preview Venn’s built-in ${platformName} profiles`, "Find connections with similar interests in Venn"][i]}.”</p>}
              </>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
