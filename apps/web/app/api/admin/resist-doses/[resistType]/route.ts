import { NextResponse } from "next/server";
import { updateResistDose, deleteResistDose } from "@/lib/admin-data";

export async function PATCH(request: Request, { params }: { params: Promise<{ resistType: string }> }) {
  const { resistType } = await params;
  const body = await request.json();
  try {
    updateResistDose(decodeURIComponent(resistType), body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ resistType: string }> }) {
  const { resistType } = await params;
  deleteResistDose(decodeURIComponent(resistType));
  return NextResponse.json({ ok: true });
}
