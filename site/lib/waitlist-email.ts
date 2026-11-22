import { transaction } from "./db";

async function deliverNext(): Promise<boolean> {
  return transaction(async (tx) => {
    const [receipt] = await tx<{ signup_id: string; email: string; ref_code: string }>(
      `SELECT r.signup_id, w.email, w.ref_code
       FROM waitlist_receipts r JOIN waitlist_signups w ON w.id = r.signup_id
       WHERE r.next_attempt_at <= now()
       ORDER BY r.next_attempt_at LIMIT 1 FOR UPDATE OF r SKIP LOCKED`,
    );
    if (!receipt) return false;

    let failure = "connection failed";
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `waitlist-receipt/${receipt.ref_code}`,
        },
        body: JSON.stringify({
          from: "Venn <hi@joinvennai.com>",
          to: [receipt.email],
          reply_to: process.env.WAITLIST_REPLY_TO?.trim() || undefined,
          subject: "You’re on the Venn waitlist",
          text: [
            "Thanks for joining Venn. We’ve saved your signup for early access. You only need to sign up once.",
            `If you’d like a friend to join you, share your personal invite link: https://joinvennai.com/?ref=${receipt.ref_code}`,
            "If your signup page says your place is pending, it will be confirmed when a friend joins through your link.",
            "The Venn team",
          ].join("\n\n"),
        }),
        signal: AbortSignal.timeout(7000),
      });
      if (response.ok) {
        await tx("DELETE FROM waitlist_receipts WHERE signup_id = $1", [receipt.signup_id]);
        return true;
      }
      failure = `HTTP ${response.status}`;
    } catch {
      // Keep addresses, credentials and provider response bodies out of logs.
    }
    console.error("waitlist: receipt delivery deferred", failure);
    await tx(
      `UPDATE waitlist_receipts SET attempts = attempts + 1,
       next_attempt_at = now() + interval '30 seconds' * power(2, least(attempts, 7))
       WHERE signup_id = $1`,
      [receipt.signup_id],
    );
    return true;
  });
}

export function startReceiptWorker() {
  const state = globalThis as typeof globalThis & { vennReceiptWorker?: boolean };
  if (state.vennReceiptWorker) return;
  state.vennReceiptWorker = true;

  async function poll() {
    let delay = 10000;
    try {
      if (await deliverNext()) delay = 1000;
    } catch {
      console.error("waitlist: receipt queue unavailable");
    }
    setTimeout(poll, delay).unref();
  }
  void poll();
}
