import { NextResponse } from "next/server";
import { updateEbeamCurrent, deleteEbeamCurrent } from "@/lib/admin-data";

export async function PATCH(request: Request, { params }: { params: Promise<{ currentNa: string }> }) {
  const { currentNa } = await params;
  const body = await request.json();
  try {
    updateEbeamCurrent(Number(currentNa), body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ currentNa: string }> }) {
  const { currentNa } = await params;
  deleteEbeamCurrent(Number(currentNa));
  return NextResponse.json({ ok: true });
}
