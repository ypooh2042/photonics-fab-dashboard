import { NextResponse } from "next/server";
import { reorderStage } from "@/lib/admin-data";

export async function POST(request: Request, { params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params;
  const body = (await request.json()) as { direction: "up" | "down" };
  if (body.direction !== "up" && body.direction !== "down") {
    return NextResponse.json({ error: "direction must be 'up' or 'down'" }, { status: 400 });
  }
  try {
    reorderStage(Number(stageId), body.direction);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
