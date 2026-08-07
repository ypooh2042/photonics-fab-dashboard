import { NextResponse } from "next/server";
import { getEquipmentUser } from "@/lib/equipment-users";

/** Non-admin (viewer-accessible) read of one equipment user — used by the chip-layout editor, which any logged-in user can open. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = getEquipmentUser(Number(id));
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(user);
}
