// Client-side: where this visit came from, read once from the address bar.

export type CampaignParams = {
  utm_source: string | null;
  utm_content: string | null;
  ref: string | null;
};

export function readCampaignParams(): CampaignParams {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source"),
    utm_content: params.get("utm_content"),
    ref: params.get("ref"),
  };
}
