import { NextResponse } from "next/server";
import { addStage } from "@/lib/admin-data";

export async function POST(request: Request, { params }: { params: Promise<{ chipRunId: string }> }) {
  const { chipRunId } = await params;
  const body = (await request.json()) as { stageType: string; label?: string };
  try {
    const id = addStage(Number(chipRunId), body.stageType as never, body.label ?? null);
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
