import { NextResponse } from "next/server";
import { listEquipmentUsers, createEquipmentUser } from "@/lib/equipment-users";

export async function GET() {
  return NextResponse.json(listEquipmentUsers());
}

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; alias?: string; isPermanent?: boolean };
  if (!body.name?.trim() || !body.alias?.trim()) {
    return NextResponse.json({ error: "name and alias required" }, { status: 400 });
  }
  try {
    const created = createEquipmentUser({
      name: body.name,
      alias: body.alias,
      isPermanent: !!body.isPermanent,
    });
    return NextResponse.json(created);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
