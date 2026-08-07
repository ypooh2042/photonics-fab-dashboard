import { NextResponse } from "next/server";
import { updateEquipmentUserCapacities, type CapacityUpdateInput } from "@/lib/equipment-users";

export async function PUT(request: Request) {
  const body = (await request.json()) as { capacities?: CapacityUpdateInput[] };
  if (!Array.isArray(body.capacities)) {
    return NextResponse.json({ error: "capacities array required" }, { status: 400 });
  }
  try {
    const updated = updateEquipmentUserCapacities(body.capacities);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
