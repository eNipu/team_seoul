"use client";

export type Consent = { analytics: boolean; ads: boolean; ts: number };
export type ConsentRegion = "opt-in" | "default-on";

export const CONSENT_KEY = "venn.consent";
export const CONSENT_EVENT = "venn:consent";
export const CONSENT_SETTINGS_EVENT = "venn:consent-settings";

const OPT_IN_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
  "GB",
  "UK",
  "CH",
]);

function globalPrivacyControl(): boolean {
  return typeof navigator !== "undefined" && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

function cleanCountry(value: string | null): string | null {
  const country = value?.trim().toUpperCase();
  return country && /^[A-Z]{2}$/.test(country) ? country : null;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function parseConsent(value: string | null): Consent | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<Consent>;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.ads !== "boolean" || typeof parsed.ts !== "number") return null;
    return parsed as Consent;
  } catch {
    return null;
  }
}

// Railway sends no country header, so fall back to the browser's timezone: Europe/* (plus the UK,
// Ireland and Switzerland, which are under Europe/* too) means opt-in; everywhere else default-on.
function regionFromTimezone(): ConsentRegion {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.startsWith("Europe/") || tz === "Atlantic/Reykjavik" || tz === "Atlantic/Canary" || tz === "Atlantic/Madeira" || tz === "Atlantic/Azores") return "opt-in";
    return tz ? "default-on" : "opt-in";
  } catch {
    return "opt-in";
  }
}

export function consentRegion(country = cleanCountry(readCookie("venn_cc"))): ConsentRegion {
  if (!country || country === "XX") return regionFromTimezone();
  return OPT_IN_COUNTRIES.has(country) ? "opt-in" : "default-on";
}

export function storedConsent(): Consent | null {
  if (typeof localStorage === "undefined") return null;
  return parseConsent(localStorage.getItem(CONSENT_KEY));
}

export function defaultConsent(): Consent {
  return { analytics: true, ads: !globalPrivacyControl(), ts: Date.now() };
}

export function effectiveConsent(): Consent | null {
  const saved = storedConsent();
  const consent = saved ?? (consentRegion() === "default-on" ? defaultConsent() : null);
  if (!consent) return null;
  return globalPrivacyControl() ? { ...consent, ads: false } : consent;
}

export function saveConsent(consent: Omit<Consent, "ts">): Consent {
  const next = { ...consent, ads: globalPrivacyControl() ? false : consent.ads, ts: Date.now() };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: next }));
  return next;
}

export function openConsentSettings() {
  window.dispatchEvent(new Event(CONSENT_SETTINGS_EVENT));
}
