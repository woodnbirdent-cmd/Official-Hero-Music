/** Show checkout refuses live Stripe keys outside a production Vercel deploy. */
export function showStripeSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = env.STRIPE_SECRET_KEY?.trim() || "";
  if (!secret) return null;
  if (secret.startsWith("sk_live_") && env.VERCEL_ENV !== "production") return null;
  return secret;
}
