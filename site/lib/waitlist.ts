import { randomBytes } from "node:crypto";

import { type Attribution } from "./analytics";
import { isUniqueViolation, query, transaction } from "./db";
import { type WaitlistVersion } from "./version";

/** The number shown to someone is this offset plus their place in the list. */
export const WAITLIST_OFFSET = 100;

// How many people a link can attach: the +1 and three more. Someone who arrived through a
// link already has their +1, so theirs holds three. Either way a circle is at most 5 people.
const ROOM_FIRST = 4;
const ROOM_INVITED = 3;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export type WaitlistSpot = {
  /** WAITLIST_OFFSET + place. Lower is earlier. */
  position: number;
  /** The code in this person's invite link (`/?ref=<code>`). */
  refCode: string;
  /** How many people joined through that link, attached to it or not. */
  referrals: number;
  /** `pending` until the first person joins with their link (the pair version only). */
  status: "pending" | "confirmed";
  version: WaitlistVersion;
  /** This person, their inviter if any, and the people attached to their link. */
  circle: number;
  /** How many more people the link can attach. */
  invitesLeft: number;
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
async function spotFor(id: string): Promise<WaitlistSpot> {
  const [row] = await query<{
    place: string;
    referrals: string;
    ref_code: string;
    version: string;
    confirmed: boolean;
    invited: boolean;
    attached: string;
  }>(
    `
    WITH counts AS (
      SELECT w.id, (SELECT count(*) FROM waitlist_signups r WHERE r.ref = w.ref_code) AS referrals
      FROM waitlist_signups w
    ),
    me AS (SELECT id, referrals FROM counts WHERE id = $1)
    SELECT
      (SELECT count(*) FROM counts c, me
        WHERE c.referrals > me.referrals OR (c.referrals = me.referrals AND c.id <= me.id)) AS place,
      me.referrals,
      w.ref_code,
      w.version,
      w.confirmed_at IS NOT NULL AS confirmed,
      w.invited_by IS NOT NULL AS invited,
      (SELECT count(*) FROM waitlist_signups i WHERE i.invited_by = w.id) AS attached
    FROM me JOIN waitlist_signups w ON w.id = me.id
    `,
    [id],
  );
  const attached = Number(row.attached);
  return {
    position: WAITLIST_OFFSET + Number(row.place),
    refCode: row.ref_code,
    referrals: Number(row.referrals),
    status: row.confirmed ? "confirmed" : "pending",
    version: row.version === "pair" ? "pair" : "open",
    circle: 1 + (row.invited ? 1 : 0) + attached,
    invitesLeft: Math.max(0, (row.invited ? ROOM_INVITED : ROOM_FIRST) - attached),
  };
}

/**
 * Adds an email to the waitlist. Joining twice is not an error: the existing spot
 * is returned unchanged, and `created` says whether this call added the row.
 *
 * Someone who arrives with a link that has room is attached to it and confirmed, and so
 * is the link's owner. Otherwise the open version confirms at once and the pair version
 * holds the place until the first person joins with this person's own link.
 */
export async function joinWaitlist(
  email: string,
  attribution: Attribution,
  version: WaitlistVersion,
): Promise<{ spot: WaitlistSpot; created: boolean }> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const { id, created } = await transaction(async (tx) => {
        // Locking the owner's row makes two people racing for the last place take turns.
        const [owner] = attribution.ref
          ? await tx<{ id: string; invited: boolean }>(
              "SELECT id, invited_by IS NOT NULL AS invited FROM waitlist_signups WHERE ref_code = $1 FOR UPDATE",
              [attribution.ref],
            )
          : [];
        let inviter: string | null = null;
        if (owner) {
          const [{ attached }] = await tx<{ attached: string }>(
            "SELECT count(*) AS attached FROM waitlist_signups WHERE invited_by = $1",
            [owner.id],
          );
          if (Number(attached) < (owner.invited ? ROOM_INVITED : ROOM_FIRST)) inviter = owner.id;
        }

        const confirmed = inviter !== null || version === "open";
        const [inserted] = await tx<{ id: string }>(
          `INSERT INTO waitlist_signups (email, utm_source, utm_content, ref, ref_code, version, invited_by, confirmed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8 THEN now() END)
           ON CONFLICT (email) DO NOTHING
           RETURNING id`,
          [email, attribution.utm_source, attribution.utm_content, attribution.ref, newRefCode(), version, inviter, confirmed],
        );
        if (!inserted) {
          const [existing] = await tx<{ id: string }>("SELECT id FROM waitlist_signups WHERE email = $1", [email]);
          return { id: existing.id, created: false };
        }
        if (inviter) {
          await tx("UPDATE waitlist_signups SET confirmed_at = now() WHERE id = $1 AND confirmed_at IS NULL", [inviter]);
        }
        return { id: inserted.id, created: true };
      });
      return { spot: await spotFor(id), created };
    } catch (error) {
      // The only unique constraint left to hit is ref_code: draw another code.
      if (!isUniqueViolation(error) || attempt >= 2) throw error;
    }
  }
}

/** Current spot for an invite code, so a returning visitor sees whether their +1 has joined. */
export async function spotForCode(refCode: string): Promise<WaitlistSpot | null> {
  const [row] = await query<{ id: string }>("SELECT id FROM waitlist_signups WHERE ref_code = $1", [refCode]);
  return row ? spotFor(row.id) : null;
}

/** Whether a link exists and can still attach someone. An unknown code is `false`. */
export async function inviteHasRoom(refCode: string): Promise<boolean> {
  const [row] = await query<{ open: boolean }>(
    `SELECT (SELECT count(*) FROM waitlist_signups i WHERE i.invited_by = w.id)
            < CASE WHEN w.invited_by IS NULL THEN $2::int ELSE $3::int END AS open
     FROM waitlist_signups w WHERE w.ref_code = $1`,
    [refCode, ROOM_FIRST, ROOM_INVITED],
  );
  return row?.open ?? false;
}
