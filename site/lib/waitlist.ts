import { randomBytes } from "node:crypto";

import { type Attribution } from "./analytics";
import { isUniqueViolation, query } from "./db";

/** The number shown to someone is this offset plus their place in the list. */
export const WAITLIST_OFFSET = 100;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export type WaitlistSpot = {
  /** WAITLIST_OFFSET + place. Lower is earlier. */
  position: number;
  /** The code in this person's invite link (`/?ref=<code>`). */
  refCode: string;
  /** How many people joined through that link. */
  referrals: number;
};

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

function newRefCode(): string {
  return Array.from(randomBytes(8), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

// Place in the list: people who brought in more signups come first, then earlier
// signups. A new signup with no referrals is therefore last: 100 + the total count.
async function spotFor(id: string, refCode: string): Promise<WaitlistSpot> {
  const [row] = await query<{ place: string; referrals: string }>(
    `
    WITH counts AS (
      SELECT w.id, (SELECT count(*) FROM waitlist_signups r WHERE r.ref = w.ref_code) AS referrals
      FROM waitlist_signups w
    ),
    me AS (SELECT id, referrals FROM counts WHERE id = $1)
    SELECT
      (SELECT count(*) FROM counts c, me
        WHERE c.referrals > me.referrals OR (c.referrals = me.referrals AND c.id <= me.id)) AS place,
      (SELECT referrals FROM me) AS referrals
    `,
    [id],
  );
  return { position: WAITLIST_OFFSET + Number(row.place), refCode, referrals: Number(row.referrals) };
}

/**
 * Adds an email to the waitlist. Joining twice is not an error: the existing spot
 * is returned, and `created` says whether this call added the row.
 */
export async function joinWaitlist(
  email: string,
  attribution: Attribution,
): Promise<{ spot: WaitlistSpot; created: boolean }> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const inserted = await query<{ id: string; ref_code: string }>(
        `INSERT INTO waitlist_signups (email, utm_source, utm_content, ref, ref_code)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, ref_code`,
        [email, attribution.utm_source, attribution.utm_content, attribution.ref, newRefCode()],
      );
      if (inserted.length > 0) {
        return { spot: await spotFor(inserted[0].id, inserted[0].ref_code), created: true };
      }
      const [existing] = await query<{ id: string; ref_code: string }>(
        "SELECT id, ref_code FROM waitlist_signups WHERE email = $1",
        [email],
      );
      return { spot: await spotFor(existing.id, existing.ref_code), created: false };
    } catch (error) {
      // The only unique constraint left to hit is ref_code: draw another code.
      if (!isUniqueViolation(error) || attempt >= 2) throw error;
    }
  }
}

/** Current spot for an invite code, so a returning visitor sees how far they moved. */
export async function spotForCode(refCode: string): Promise<WaitlistSpot | null> {
  const [row] = await query<{ id: string }>("SELECT id FROM waitlist_signups WHERE ref_code = $1", [refCode]);
  return row ? spotFor(row.id, refCode) : null;
}
