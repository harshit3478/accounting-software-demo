export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = process.env.BUSINESS_TIMEZONE?.trim() || "America/Chicago";
  }
}
