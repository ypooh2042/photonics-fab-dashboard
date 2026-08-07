import { NextResponse } from "next/server";
import { clearChipRunReview, updateChipRunLabel, updateChipRunProject, deleteChipRun } from "@/lib/admin-data";

export async function PATCH(request: Request, { params }: { params: Promise<{ chipRunId: string }> }) {
  const { chipRunId } = await params;
  const body = (await request.json()) as { clearReview?: boolean; label?: string; projectId?: number };
  if (body.clearReview) clearChipRunReview(Number(chipRunId));
  if (body.label) updateChipRunLabel(Number(chipRunId), body.label);
  if (body.projectId) {
    try {
      updateChipRunProject(Number(chipRunId), body.projectId);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ chipRunId: string }> }) {
  const { chipRunId } = await params;
  try {
    deleteChipRun(Number(chipRunId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
