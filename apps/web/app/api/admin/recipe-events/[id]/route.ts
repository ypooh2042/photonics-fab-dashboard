import { NextResponse } from "next/server";
import { updateRecipeEvent, deleteRecipeEvent } from "@/lib/admin-data";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { eventDate: string; label: string };
  if (!body.eventDate?.trim() || !body.label?.trim()) {
    return NextResponse.json({ error: "eventDate and label required" }, { status: 400 });
  }
  try {
    updateRecipeEvent(Number(id), body.eventDate.trim(), body.label.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteRecipeEvent(Number(id));
  return NextResponse.json({ ok: true });
}
