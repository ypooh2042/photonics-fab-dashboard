import { NextResponse } from "next/server";
import { getActiveWeekId, getWeekUserLoadingCostMinutes, setWeekUserLoadingSnapshot, recomputeWeekUser } from "@/lib/queue";

/** This week's loading time for one equipment user — separate from equipment_users.loading_cost_minutes (the default), editable from the chip-layout job editor. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const weekId = getActiveWeekId();
  const loadingCostMinutes = getWeekUserLoadingCostMinutes(weekId, Number(id));
  return NextResponse.json({ weekId, loadingCostMinutes });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const equipmentUserId = Number(id);
  const body = (await request.json()) as { loadingCostMinutes?: number };
  if (typeof body.loadingCostMinutes !== "number" || !Number.isFinite(body.loadingCostMinutes) || body.loadingCostMinutes < 0) {
    return NextResponse.json({ error: "로딩 시간은 0 이상이어야 합니다" }, { status: 400 });
  }

  const weekId = getActiveWeekId();
  setWeekUserLoadingSnapshot(weekId, equipmentUserId, body.loadingCostMinutes);
  recomputeWeekUser(weekId, equipmentUserId);

  return NextResponse.json({ weekId, loadingCostMinutes: body.loadingCostMinutes });
}
