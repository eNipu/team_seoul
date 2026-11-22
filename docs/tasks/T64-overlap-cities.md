# T64 — Support multiple cities in Overlap

**Purpose:** Let people use Overlap outside Seoul. Start with Berlin plus the existing Seoul neighborhoods.

**Read:** `T53-venn-overlap.md`, `T63-overlap-onboarding-location.md`, and `../WEB_API.md`.

- Default the city picker to Berlin on new windows and in location settings. Keep a saved neighborhood private and show its city in settings; using it for a window remains an explicit choice.
- Filter neighborhoods by city. Switching cities clears the current window neighborhood and refreshes date and slot options. Neither Berlin nor choosing a city saves anything or opts anyone in.
- Use the selected neighborhood's city time zone for dates, slot cutoffs, and public meeting points. Match only the same neighborhood, local date and slot under the existing consent and shared-interest rules.
- Keep Seoul codes and existing API shapes. The shared catalog defines names, IANA time zones, and public spots. Use globally unique area codes of at most 16 characters and update the backend `Area` type when adding one.

**Acceptance:** Onboarding and Account can save or clear a neighborhood from either city. Two Berlin seats can match, get introduced, and separately agree to a local spot. Seoul remains selectable and does not match a Berlin window.
