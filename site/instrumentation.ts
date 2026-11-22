export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build"
      && process.env.RESEND_API_KEY && process.env.DATABASE_URL) {
    const { startReceiptWorker } = await import("./lib/waitlist-email");
    startReceiptWorker();
  }
}
