// Discovery dates are calendar dates in Seoul, never the browser's local timezone.
export const SLOTS = ["morning", "afternoon", "evening"] as const;
export function openSlots(date: string, now = Date.now()): string[] {
  const start = Date.parse(`${date}T00:00:00+09:00`);
  return SLOTS.filter((_, i) => now < start + [12, 18, 24][i] * 3600000);
}

export function seoulWeek(now = Date.now()): string[] {
  const seoulDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  return Array.from({ length: 7 }, (_, i) => seoulDate.format(now + i * 86400000));
}
