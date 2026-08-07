import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SESSION_COOKIE, signSession } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };
  if (!password) {
    return NextResponse.json({ error: "password required" }, { status: 400 });
  }

  const adminHash = process.env.ADMIN_PASSWORD_HASH;
  const viewerHash = process.env.VIEWER_PASSWORD_HASH;

  let role: "viewer" | "admin" | null = null;
  if (adminHash && (await bcrypt.compare(password, adminHash))) {
    role = "admin";
  } else if (viewerHash && (await bcrypt.compare(password, viewerHash))) {
    role = "viewer";
  }

  if (!role) {
    return NextResponse.json({ error: "invalid password" }, { status: 401 });
  }

  const token = await signSession(role);
  const response = NextResponse.json({ ok: true, role });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Only mark the cookie Secure once this app is actually served over HTTPS
    // (e.g. behind nginx+certbot). Tying this to NODE_ENV=production was wrong —
    // the MVP deployment is plain HTTP on the LAN, and browsers silently refuse
    // to store a Secure cookie on an insecure origin, which broke login entirely.
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
