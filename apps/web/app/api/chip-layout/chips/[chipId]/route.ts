import { NextResponse } from "next/server";
import { updateChip, deleteChip } from "@/lib/chip-layout";

export async function PATCH(request: Request, { params }: { params: Promise<{ chipId: string }> }) {
  const { chipId } = await params;
  const body = await request.json();
  try {
    const chip = updateChip(Number(chipId), body);
    return NextResponse.json(chip);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ chipId: string }> }) {
  const { chipId } = await params;
  try {
    deleteChip(Number(chipId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
