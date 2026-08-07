import { NextResponse } from "next/server";
import { reorderStages } from "@/lib/admin-data";

export async function POST(request: Request, { params }: { params: Promise<{ chipRunId: string }> }) {
  const { chipRunId } = await params;
  const body = (await request.json()) as { orderedStageIds: number[] };
  if (!Array.isArray(body.orderedStageIds) || body.orderedStageIds.some((id) => typeof id !== "number")) {
    return NextResponse.json({ error: "orderedStageIds must be an array of numbers" }, { status: 400 });
  }
  try {
    reorderStages(Number(chipRunId), body.orderedStageIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
