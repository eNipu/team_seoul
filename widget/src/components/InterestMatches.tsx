import { useId } from "react";
import type { InterestMatchResult } from "../types";
import { ActionError, useAction } from "./common";
import "./interest-matches.css";

type ActionResult = void | string | null;
type Completion = ActionResult | Promise<ActionResult>;

interface Props {
  matches: readonly InterestMatchResult[];
  onRetry: () => Completion;
  onCommonGround: (row: InterestMatchResult) => Completion;
  /** Plan ideas live one tap further, on the common-ground card ("Get more ideas"). */
  onPlan?: (row: InterestMatchResult) => Completion;
}

export function InterestMatches({ matches, onRetry, onCommonGround }: Props) {
  const heading = useId();
  const action = useAction();
  const busy = action.busy !== null;
  const grounded = matches.filter((row) => row.interest_matches.length > 0);
  function inspect(key: string, open: () => Completion) {
    void action.run(key, async () => (await open()) ?? null);
  }

  return (
    <section className="panel interest-matches" aria-labelledby={heading}>
      <header>
        <h2 id={heading}>Interest matches</h2>
        <p className="muted">Pick someone to compare.</p>
      </header>
      <ActionError action={action} />
      {grounded.length === 0 ? (
        <div className="card">
          <h3>No matches yet</h3>
          <p className="muted">Try again after saving an interest of your own or importing another Instagram or LinkedIn contact with interests.</p>
          <button type="button" className="btn" disabled={busy} onClick={() => inspect("retry", onRetry)}>
            {busy ? "Checking…" : "Check for matches again"}
          </button>
        </div>
      ) : (
        <ul className="list list--tight">
          {grounded.map((row) => (
            <li className="card" key={`${row.kind}:${row.id}`}>
              <h3>{row.display_name}</h3>
              <ul className="interest-matches__evidence" aria-label={`Why ${row.display_name} matched`}>
                {row.interest_matches.map((pair, i) => (
                  <li key={i}>
                    {pair.kind === "exact" ? <><strong>In common:</strong> {pair.my_label}</> : (
                      <><strong>Related interests:</strong> {pair.my_label} (you) and {pair.their_label} ({row.display_name})</>
                    )}
                  </li>
                ))}
              </ul>
              <button type="button" className="onb__link" disabled={busy} onClick={() => inspect("ground", () => onCommonGround(row))}>
                {action.busy === "ground" ? "Opening…" : "See what you share"}<span className="sr-only"> with {row.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
