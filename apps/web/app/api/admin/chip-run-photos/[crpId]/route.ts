import { NextResponse } from "next/server";
import { deletePhotoAttachment } from "@/lib/admin-data";

export async function DELETE(_request: Request, { params }: { params: Promise<{ crpId: string }> }) {
  const { crpId } = await params;
  deletePhotoAttachment(Number(crpId));
  return NextResponse.json({ ok: true });
}
