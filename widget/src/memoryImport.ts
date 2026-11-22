// Venn cannot read ChatGPT's memory. Ask the host model to prepare a card, not a chat checklist.

export interface ImportAreaLike {
  value: string;
  label: string;
  description: string;
}

/**
 * The message sent into the chat. Areas keep their payload order; the "Leave out these areas"
 * line is omitted when every area is selected.
 */
export function buildMemoryImportPrompt(
  areas: readonly ImportAreaLike[],
  selectedValues: Iterable<string>,
  maxItems: number,
): string {
  const selected = new Set(selectedValues);
  const included = areas.filter((a) => selected.has(a.value));
  const excluded = areas.filter((a) => !selected.has(a.value));
  const lines = [
    "Prepare my ChatGPT memories for private import into Venn.",
    "",
    "From what you already remember about me (saved memories and past chats), use only these areas:",
    ...included.map((a) => (a.description ? `- ${a.label}: ${a.description}` : `- ${a.label}`)),
    "",
  ];
  if (excluded.length > 0) lines.push(`Leave out these areas: ${excluded.map((a) => a.label).join(", ")}.`);
  lines.push(
    "Always leave out health, money, passwords and ID numbers, and anything you are not sure is about me.",
    "",
    `Call venn_propose_memories with source "chatgpt_memory", quick_import: true, and up to ${maxItems} structured candidates.`,
    INTEREST_INSTRUCTION,
    "Don't list them in chat or ask me to reply with picks. I’ll choose and import on the card. If you don't remember anything in these areas, say so without guessing.",
  );
  return lines.join("\n");
}

const INTEREST_INSTRUCTION =
  "When interests are in scope, create one INTEREST candidate per clear hobby or topic I enjoy, using a short topic title and leaving people off my own interests. Do not infer interests from my job, acquaintances, or a one-off activity.";

/** Give ChatGPT a turn to prepare the import. Only the Import button on that card saves. */
export const QUICK_IMPORT_PROMPT =
  'Find my ChatGPT memories for Venn. Call venn_propose_memories with quick_import: true, source "chatgpt_memory", ' +
  "and up to 30 structured candidates from what you already remember about me. Prioritize my interests and hobbies. " +
  INTEREST_INSTRUCTION + " Leave out health, money, passwords, ID numbers and anything you're not sure is about me. " +
  "Don't list memories in chat or ask me to verify them there. I'll choose and import privately on the card. " +
  "If you don't remember anything about me, say so instead of guessing.";
