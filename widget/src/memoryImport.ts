// Pure prompt builder for "Import my ChatGPT memory". Heldly cannot read ChatGPT's memory, so the
// widget asks ChatGPT (in the chat) to list what it remembers; nothing reaches Heldly until the
// user picks what to keep. No imports here, so the file also runs directly under node.

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
    "Import my ChatGPT memory into Heldly — preview first.",
    "",
    "From what you already remember about me (saved memories and past chats), list what fits these areas:",
    ...included.map((a) => (a.description ? `- ${a.label}: ${a.description}` : `- ${a.label}`)),
    "",
  ];
  if (excluded.length > 0) lines.push(`Leave out these areas: ${excluded.map((a) => a.label).join(", ")}.`);
  lines.push(
    "Always leave out health, money, passwords and ID numbers, and anything you are not sure is about me.",
    "",
    `Show me the list here in the chat, numbered, at most ${maxItems} items, and don't send anything to Heldly yet. ` +
      "If you don't remember anything about me, say so. When I tell you which ones to keep, call heldly_propose_memories " +
      'with source "chatgpt_memory" for just those, so I can confirm them on the card.',
  );
  return lines.join("\n");
}
