import { useState, type CSSProperties } from "react";
import { formatDaysAgo, type ImportCandidate } from "../types";
import ImportInterests from "./ImportInterests";
import { Avatar } from "./common";
import { Icon } from "./icons";
import "./people-radar.css";

const PAGE_SIZE = 4;
const recentlyMet = (person: ImportCandidate) => person.last_met_days_ago !== null && person.last_met_days_ago <= 30;

interface Props {
  candidates: ImportCandidate[];
  picked: Set<number>;
  busy: boolean;
  toggle: (person: ImportCandidate) => void;
}

export default function PeopleRadar({ candidates, picked, busy, toggle }: Props) {
  const [focus, setFocus] = useState(0);
  const person = candidates[focus];
  const page = Math.floor(focus / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const group = candidates.slice(start, start + PAGE_SIZE);
  const selected = picked.has(person.index);
  const pages = Math.ceil(candidates.length / PAGE_SIZE);

  return (
    <div className="people-radar">
      <div className="radar-display">
        <div className="radar-map" role="group" aria-label="People on your radar">
          <div className="radar-sweep" aria-hidden="true" />
          <div className="radar-orbit radar-orbit--outer" aria-hidden="true" />
          <div className="radar-orbit radar-orbit--inner" aria-hidden="true" />
          <span className="radar-self">You</span>
          {group.map((candidate, slot) => {
            const radius = recentlyMet(candidate) ? 23 : 39;
            const angle = (slot / group.length) * Math.PI * 2 - Math.PI / 3;
            const active = start + slot === focus;
            const hasMatch = !!(candidate.shared_interests?.length || candidate.related_interests?.length);
            const style: CSSProperties = {
              left: `${50 + radius * Math.cos(angle)}%`,
              top: `${50 + radius * Math.sin(angle)}%`,
              animationDelay: `${slot * 90}ms`,
            };
            return (
              <button key={candidate.index} type="button" className="radar-person" style={style}
                title={candidate.name} aria-pressed={active} aria-controls="radar-person-details"
                aria-label={`Inspect ${candidate.name}${candidate.relationship ? ", " + candidate.relationship : ""}${hasMatch ? ", interest match" : ""}${picked.has(candidate.index) ? ", selected to add" : ""}`}
                onClick={() => setFocus(start + slot)}>
                <span className="radar-pin">
                  <Avatar name={candidate.name} size="small" />
                  {picked.has(candidate.index) ? <span className="radar-indicator"><Icon name="check" size={12} /></span>
                    : hasMatch && <span className="radar-indicator"><Icon name="sparkle" size={12} /></span>}
                </span>
                <span className="radar-label">{candidate.name.split(/\s+/)[0]}</span>
              </button>
            );
          })}
        </div>
        <p className="radar-key">Inner · Met within 30 days<br/>Outer · Earlier or date unknown</p>
        {pages > 1 && (
          <div className="radar-pages">
            <button type="button" aria-label="Previous people" disabled={!page} onClick={() => setFocus(start - PAGE_SIZE)}>
              <Icon name="arrow-left" size={18} />
            </button>
            <span aria-live="polite">{page + 1} / {pages}</span>
            <button type="button" aria-label="Next people" disabled={page + 1 === pages} onClick={() => setFocus(start + PAGE_SIZE)}>
              <Icon name="arrow-right" size={18} />
            </button>
          </div>
        )}
      </div>
      <section id="radar-person-details" className="radar-detail" aria-label="Person details">
        <Avatar name={person.name} />
        <h3>{person.name}</h3>
        {person.relationship && <p>{person.relationship}</p>}
        {person.last_met_days_ago !== null && <p className="muted small">Last met {formatDaysAgo(person.last_met_days_ago)}</p>}
        {person.notes && <p className="small">{person.notes}</p>}
        <ImportInterests {...person} />
        {person.already_added && <p className="radar-warning">Same name in your people{person.existing_relationships?.length ? ` · ${person.existing_relationships.join(", ")}` : ""}. Select only to add a separate person.</p>}
        <button type="button" className="onb__link" disabled={busy} aria-pressed={selected} onClick={() => toggle(person)}>
          {selected ? `Leave ${person.name.split(/\s+/)[0]} out` : `Add ${person.name.split(/\s+/)[0]} back`}
        </button>
      </section>
    </div>
  );
}
