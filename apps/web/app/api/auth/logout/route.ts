import { NextResponse } from "next/server";
import { SESSION_COOKIE, OPERATOR_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(OPERATOR_COOKIE);
  return response;
}
