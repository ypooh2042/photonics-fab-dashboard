import { NextResponse } from "next/server";
import { getActiveWeekId, getQueueSections, getWeeklySettings } from "@/lib/queue";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const settings = getWeeklySettings();
  const weekId = searchParams.get("week") ?? getActiveWeekId(settings);

  return NextResponse.json({
    weekId,
    weeklyCapacityHours: settings.weeklyCapacityHours,
    sections: getQueueSections(weekId),
  });
}
