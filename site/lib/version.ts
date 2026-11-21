// The waitlist has two versions (docs/tasks/WAITLIST.md):
//   pair  a place is held until one person joins with your link, then both are confirmed
//   open  confirmed on joining; inviting is optional

export type WaitlistVersion = "pair" | "open";

export function cleanVersion(value: unknown): WaitlistVersion | null {
  return value === "pair" || value === "open" ? value : null;
}

/** The version a page shows without `?w=`. Server only: it reads the environment. */
export function defaultVersion(): WaitlistVersion {
  return cleanVersion(process.env.WAITLIST_VERSION) ?? "pair";
}
