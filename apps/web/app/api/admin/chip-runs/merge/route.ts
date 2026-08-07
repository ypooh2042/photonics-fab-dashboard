import { NextResponse } from "next/server";
import { mergeChipRuns } from "@/lib/admin-data";

export async function POST(request: Request) {
  const body = (await request.json()) as { sourceId: number; targetId: number };
  if (!body.sourceId || !body.targetId) {
    return NextResponse.json({ error: "sourceId and targetId required" }, { status: 400 });
  }
  try {
    mergeChipRuns(body.sourceId, body.targetId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
