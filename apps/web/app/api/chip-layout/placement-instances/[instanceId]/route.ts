import { NextResponse } from "next/server";
import { updatePlacementInstance, deletePlacementInstance } from "@/lib/chip-layout";

export async function PATCH(request: Request, { params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = await params;
  const body = await request.json();
  try {
    const updated = updatePlacementInstance(Number(instanceId), body);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = await params;
  try {
    deletePlacementInstance(Number(instanceId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
