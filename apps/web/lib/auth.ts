import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "fab_session";
export type Role = "viewer" | "admin";

// Separate, additional unlock for the beta LLM-extraction section (/admin/extraction/*) —
// on top of the regular admin role, not instead of it. Kept as its own cookie/JWT rather
// than a third Role value since it's an extra gate on a subsection, not a distinct
// permission tier the rest of the app needs to reason about.
export const OPERATOR_COOKIE = "fab_operator_session";

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

export async function signSession(role: Role): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<{ role: Role } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role === "viewer" || payload.role === "admin") {
      return { role: payload.role };
    }
    return null;
  } catch {
    return null;
  }
}

export async function signOperatorSession(): Promise<string> {
  return new SignJWT({ operator: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifyOperatorSession(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.operator === true;
  } catch {
    return false;
  }
}
