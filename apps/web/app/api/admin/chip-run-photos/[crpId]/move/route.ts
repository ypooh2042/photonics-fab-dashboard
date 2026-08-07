import { NextResponse } from "next/server";
import { movePhoto } from "@/lib/admin-data";

export async function POST(request: Request, { params }: { params: Promise<{ crpId: string }> }) {
  const { crpId } = await params;
  const body = (await request.json()) as { targetStageId: number };
  if (!body.targetStageId) {
    return NextResponse.json({ error: "targetStageId required" }, { status: 400 });
  }
  try {
    movePhoto(Number(crpId), body.targetStageId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
