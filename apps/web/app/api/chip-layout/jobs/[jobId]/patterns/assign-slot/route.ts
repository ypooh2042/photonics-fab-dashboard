import { NextResponse } from "next/server";
import { assignPatternSlot } from "@/lib/chip-layout";

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const body = (await request.json()) as { slotIndex?: number; patternKey?: string };
  if (body.slotIndex == null || !body.patternKey) {
    return NextResponse.json({ error: "slotIndex, patternKey required" }, { status: 400 });
  }
  try {
    assignPatternSlot(Number(jobId), body.slotIndex, body.patternKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
