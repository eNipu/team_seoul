import catalog from "../../backend/app/schemas/overlap_cities.json";

export type OverlapCity = keyof typeof catalog;
export type OverlapArea = { [C in OverlapCity]: keyof (typeof catalog)[C]["areas"] }[OverlapCity];
export const DEFAULT_OVERLAP_CITY: OverlapCity = "berlin";
export const OVERLAP_CITIES = Object.keys(catalog) as OverlapCity[];
export const overlapCityInfo = (city: OverlapCity) => catalog[city];

const areas = new Map<string, { code: OverlapArea; city: OverlapCity; name: string; spot: string }>();
for (const city of OVERLAP_CITIES) {
  for (const [code, details] of Object.entries(catalog[city].areas)) {
    areas.set(code, { code: code as OverlapArea, city, ...details });
  }
}

export const overlapAreaInfo = (area: OverlapArea) => areas.get(area)!;
export const overlapAreasIn = (city: OverlapCity) => Object.keys(catalog[city].areas) as OverlapArea[];
export const findOverlapArea = (area: unknown) => typeof area === "string" ? areas.get(area)?.code : undefined;
