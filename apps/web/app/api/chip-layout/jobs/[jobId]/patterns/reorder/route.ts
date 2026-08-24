import { NextResponse } from "next/server";
import { reorderPatternSlots } from "@/lib/chip-layout";

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const body = (await request.json()) as { patternKeys?: string[] };
  if (!Array.isArray(body.patternKeys) || body.patternKeys.length === 0) {
    return NextResponse.json({ error: "patternKeys required" }, { status: 400 });
  }
  try {
    reorderPatternSlots(Number(jobId), body.patternKeys);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
