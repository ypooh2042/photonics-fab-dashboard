import { NextResponse } from "next/server";
import { completeSubmission } from "@/lib/queue";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { weekId?: string };
  if (!body.weekId) return NextResponse.json({ error: "weekId required" }, { status: 400 });
  try {
    completeSubmission(Number(id), body.weekId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
