import { NextResponse } from "next/server";
import { getActiveWeekId, getWeeklySettings } from "@/lib/queue";
import { updateWeeklySettings } from "@/lib/admin-data";

function withCurrentWeek(settings: ReturnType<typeof getWeeklySettings>) {
  return { ...settings, currentWeekId: getActiveWeekId(settings) };
}

export async function GET() {
  return NextResponse.json(withCurrentWeek(getWeeklySettings()));
}

export async function PUT(request: Request) {
  const body = await request.json();
  updateWeeklySettings(body);
  return NextResponse.json(withCurrentWeek(getWeeklySettings()));
}
