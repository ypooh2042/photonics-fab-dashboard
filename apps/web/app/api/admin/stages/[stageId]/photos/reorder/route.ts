import { NextResponse } from "next/server";
import { reorderStagePhotos } from "@/lib/admin-data";

export async function POST(request: Request, { params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params;
  const body = (await request.json()) as { orderedCrpIds: number[] };
  if (!Array.isArray(body.orderedCrpIds) || body.orderedCrpIds.some((id) => typeof id !== "number")) {
    return NextResponse.json({ error: "orderedCrpIds must be an array of numbers" }, { status: 400 });
  }
  try {
    reorderStagePhotos(Number(stageId), body.orderedCrpIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
