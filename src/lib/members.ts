import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { accountsConfigured, auth, getPool } from "@/lib/auth";
import { isTier, safeNextPath, tierAtLeast, type Tier } from "@/lib/tiers";

export type Member = {
  id: string;
  email: string;
  name: string;
  tier: Tier;
  stripeCustomerId: string | null;
};

let schemaTask: Promise<void> | null = null;

export async function ensureSchema(): Promise<void> {
  if (!accountsConfigured()) return;
  if (!schemaTask) {
    schemaTask = applySchema().catch((error) => {
      schemaTask = null;
      throw error;
    });
  }
  await schemaTask;
}

async function applySchema(): Promise<void> {
  const { getMigrations } = await import("better-auth/db/migration");
  const plan = await getMigrations(auth.options);
  if (plan.toBeCreated.length > 0 || plan.toBeAdded.length > 0 || plan.toBeAddedIndexes.length > 0) {
    await plan.runMigrations();
  }
}

export async function getSessionUser(): Promise<{ id: string; email: string; name: string } | null> {
  if (!accountsConfigured()) return null;
  try {
    await ensureSchema();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id || !session.user.email) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name || "",
    };
  } catch (error) {
    console.error("Session lookup failed", error);
    return null;
  }
}

export async function currentMember(): Promise<Member | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const pool = getPool();
  if (!pool) return null;
  const result = await pool.query<{
    tier: string;
    email: string;
    name: string;
    stripeCustomerId: string | null;
  }>(
    `SELECT tier, email, name, "stripeCustomerId" FROM "user" WHERE id = $1`,
    [user.id],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: user.id,
    email: row.email,
    name: row.name,
    tier: isTier(row.tier) ? row.tier : "free",
    stripeCustomerId: row.stripeCustomerId,
  };
}

export async function requireTier(minimum: Tier, from: string): Promise<Member> {
  const member = await currentMember();
  if (!member) {
    redirect(`/sign-in?next=${encodeURIComponent(safeNextPath(from, "/members"))}`);
  }
  if (!tierAtLeast(member.tier, minimum)) {
    redirect(`/join?upgrade=${minimum}`);
  }
  return member;
}

export async function setMemberTier(
  tier: Tier,
  ids: { userId?: string | null; stripeCustomerId?: string | null },
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await ensureSchema();
  if (ids.userId) {
    await pool.query(
      `UPDATE "user"
       SET tier = $1,
           "stripeCustomerId" = COALESCE($2, "stripeCustomerId"),
           "updatedAt" = NOW()
       WHERE id = $3`,
      [tier, ids.stripeCustomerId ?? null, ids.userId],
    );
    return;
  }
  if (ids.stripeCustomerId) {
    await pool.query(
      `UPDATE "user" SET tier = $1, "updatedAt" = NOW() WHERE "stripeCustomerId" = $2`,
      [tier, ids.stripeCustomerId],
    );
  }
}

export async function saveStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await ensureSchema();
  await pool.query(`UPDATE "user" SET "stripeCustomerId" = $1, "updatedAt" = NOW() WHERE id = $2`, [
    stripeCustomerId,
    userId,
  ]);
}
