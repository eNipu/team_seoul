import { overlapCityInfo, type OverlapCity } from "./overlapCities";

export const SLOTS = ["morning", "afternoon", "evening"] as const;
export const SPOT_HOURS = { morning: 10, afternoon: 15, evening: 19 };
const formatters = new Map<OverlapCity, Intl.DateTimeFormat>();

// Use the selected city's calendar and wall clock, never the browser's timezone.
export function cityClock(city: OverlapCity, now = Date.now()) {
  let format = formatters.get(city);
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", {
      timeZone: overlapCityInfo(city).timezone,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
    });
    formatters.set(city, format);
  }
  const parts = Object.fromEntries(format.formatToParts(now).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function openSlots(city: OverlapCity, date: string, now = Date.now()) {
  const local = cityClock(city, now);
  return SLOTS.filter((_, i) => date > local.date || (date === local.date && local.hour < [12, 18, 24][i]));
}

export function cityWeek(city: OverlapCity, now = Date.now()): string[] {
  const today = Date.parse(`${cityClock(city, now).date}T00:00:00Z`);
  // This is calendar arithmetic on date labels, not 24-hour intervals in the city.
  return Array.from({ length: 7 }, (_, i) => new Date(today + i * 86400000).toISOString().slice(0, 10));
}
