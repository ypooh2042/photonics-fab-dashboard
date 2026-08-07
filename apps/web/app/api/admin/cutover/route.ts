import { NextResponse } from "next/server";
import { runManualCutover } from "@/lib/queue";

export async function POST() {
  const result = runManualCutover();
  if (!result) return NextResponse.json({ error: "no open week to cut over" }, { status: 400 });
  return NextResponse.json(result);
}
