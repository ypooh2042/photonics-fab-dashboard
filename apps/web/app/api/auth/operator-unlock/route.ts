import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { OPERATOR_COOKIE, signOperatorSession } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };
  if (!password) {
    return NextResponse.json({ error: "password required" }, { status: 400 });
  }

  const operatorHash = process.env.OPERATOR_PASSWORD_HASH;
  if (!operatorHash || !(await bcrypt.compare(password, operatorHash))) {
    return NextResponse.json({ error: "invalid password" }, { status: 401 });
  }

  const token = await signOperatorSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(OPERATOR_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
