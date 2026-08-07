import { NextResponse } from "next/server";
import { moveStage } from "@/lib/admin-data";

export async function POST(request: Request, { params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params;
  const body = (await request.json()) as { targetChipRunId: number };
  if (!body.targetChipRunId) {
    return NextResponse.json({ error: "targetChipRunId required" }, { status: 400 });
  }
  try {
    moveStage(Number(stageId), body.targetChipRunId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
