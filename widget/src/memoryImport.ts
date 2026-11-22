// Pure prompt builder for "Import my ChatGPT memory". Venn cannot read ChatGPT's memory, so the
// widget asks ChatGPT (in the chat) to list what it remembers; nothing reaches Venn until the
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
    "Import my ChatGPT memory into Venn — preview first.",
    "",
    "From what you already remember about me (saved memories and past chats), list what fits these areas:",
    ...included.map((a) => (a.description ? `- ${a.label}: ${a.description}` : `- ${a.label}`)),
    "",
  ];
  if (excluded.length > 0) lines.push(`Leave out these areas: ${excluded.map((a) => a.label).join(", ")}.`);
  lines.push(
    "Always leave out health, money, passwords and ID numbers, and anything you are not sure is about me.",
    "",
    `Show at most ${Math.min(3, maxItems)} short, numbered candidates per batch here in chat, one line each. Then stop and wait. ` +
      `Only show another batch if I ask for more; keep numbering across batches and stop at ${maxItems} candidates total. ` +
      "If you don’t remember anything, say so. Ask me to pick specific numbers, or none. Don’t send anything to Venn until I choose. " +
      'Call venn_propose_memories with source "chatgpt_memory" for just my picks, so I can confirm them on the card.',
  );
  return lines.join("\n");
}

/** One tap on "Connect": no list in the chat first. Everything is saved privately; the user can review after. */
export const QUICK_IMPORT_PROMPT =
  "Connect my AI memories to Venn. Call venn_propose_memories now with quick_import: true, source \"chatgpt_memory\" " +
  "and everything you remember about me (saved memories and past chats, up to 30). Don't list them in the chat first. " +
  "Leave out health, money, passwords, ID numbers and anything you're not sure is about me. " +
  "If you don't remember anything about me, just ask me one question about who I want to be closer to.";
