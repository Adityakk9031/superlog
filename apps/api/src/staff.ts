import { db, schema } from "@superlog/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

// Staff gate for the remaining operational routes.
//
// Staff is anyone whose user row has "admin" in the Better Auth admin plugin's
// `role` column (comma-separated list). Grant/revoke at runtime via SQL or
// `authClient.admin.setRole` — no redeploy required.
export function userIsStaff(role: string | null | undefined): boolean {
  if (!role) return false;
  return role.split(",").some((r) => r.trim() === "admin");
}

export async function isStaff(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  // Banned admins lose access here too — Better Auth's session middleware
  // already gates banned users, but defense-in-depth in case that gate is
  // ever bypassed or misconfigured.
  if (!user || user.banned) return false;
  return userIsStaff(user.role);
}

export async function requireStaff(userId: string): Promise<void> {
  if (!(await isStaff(userId))) {
    throw new HTTPException(403, { message: "admin access required" });
  }
}
