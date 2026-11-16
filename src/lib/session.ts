import { cookies } from "next/headers";
import { db } from "./db";

/**
 * STUB SESSION — replace with Auth.js (PRD F1) before launch.
 *
 * There is no login yet. The first upload creates an anonymous organization
 * and stores its id in an httpOnly cookie. The id is an unguessable cuid, so
 * this is adequate for local testing, but it is not real authentication:
 * clearing cookies loses access, and there are no users or memberships.
 */
const COOKIE = "attestly_org";

export async function getOrgId(): Promise<string | null> {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const org = await db.organization.findUnique({ where: { id }, select: { id: true } });
  return org?.id ?? null;
}

/** Only callable from a Route Handler or Server Action (it sets a cookie). */
export async function getOrCreateOrgId(): Promise<string> {
  const existing = await getOrgId();
  if (existing) return existing;
  const org = await db.organization.create({ data: { name: "My company" } });
  (await cookies()).set(COOKIE, org.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return org.id;
}
