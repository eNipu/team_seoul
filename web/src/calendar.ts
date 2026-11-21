// Pure helpers for the "Add to calendar" action. No DOM, no host access.

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYYMMDDTHHMMSSZ` (UTC), the compact form Google Calendar expects. */
export function formatCalendarUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export interface CalendarEvent {
  title: string;
  details: string;
  start: Date;
  /** Defaults to two hours. */
  durationMinutes?: number;
}

/** Prefilled Google Calendar "new event" link. Nothing is created until the user saves it there. */
export function buildCalendarUrl({ title, details, start, durationMinutes = 120 }: CalendarEvent): string {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const dates = `${formatCalendarUtc(start)}/${formatCalendarUtc(end)}`;
  return (
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(title)}` +
    `&details=${encodeURIComponent(details)}` +
    `&dates=${dates}`
  );
}

/** The coming Saturday at 11:00 local time (a week ahead when today is Saturday). */
export function nextSaturdayAt11(now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0, 0);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d;
}

/** Local wall-clock value for `<input type="datetime-local">`: `YYYY-MM-DDTHH:MM`. */
export function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse a `datetime-local` value as local time. Returns null when empty or invalid. */
export function parseLocalInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
  return Number.isNaN(d.getTime()) ? null : d;
}
