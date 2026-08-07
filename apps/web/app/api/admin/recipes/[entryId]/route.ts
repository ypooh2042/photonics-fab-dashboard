import { NextResponse } from "next/server";
import { updateRecipeEntry, deleteRecipeEntry } from "@/lib/admin-data";

export async function PATCH(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const body = await request.json();
  try {
    updateRecipeEntry(Number(entryId), body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  deleteRecipeEntry(Number(entryId));
  return NextResponse.json({ ok: true });
}
