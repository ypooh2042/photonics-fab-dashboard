import { NextResponse } from "next/server";
import { listEbeamCurrents, createEbeamCurrent } from "@/lib/admin-data";

export async function GET() {
  return NextResponse.json(listEbeamCurrents());
}

export async function POST(request: Request) {
  const body = (await request.json()) as { currentNa: number; label: string };
  if (typeof body.currentNa !== "number" || !body.label?.trim()) {
    return NextResponse.json({ error: "currentNa and label required" }, { status: 400 });
  }
  try {
    createEbeamCurrent({ currentNa: body.currentNa, label: body.label.trim() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
