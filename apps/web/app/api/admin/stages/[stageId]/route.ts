import { NextResponse } from "next/server";
import { updateStage, deleteStage } from "@/lib/admin-data";

export async function PATCH(request: Request, { params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params;
  const body = await request.json();
  try {
    updateStage(Number(stageId), body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params;
  deleteStage(Number(stageId));
  return NextResponse.json({ ok: true });
}
