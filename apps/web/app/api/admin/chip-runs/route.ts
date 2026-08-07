import { NextResponse } from "next/server";
import { createChipRun } from "@/lib/admin-data";
import { listChipRuns } from "@/lib/data";

export async function GET() {
  return NextResponse.json(listChipRuns());
}

export async function POST(request: Request) {
  const body = (await request.json()) as { projectId: number; label: string };
  if (!body.projectId || !body.label?.trim()) {
    return NextResponse.json({ error: "projectId and label are required" }, { status: 400 });
  }
  try {
    const id = createChipRun(body.projectId, body.label.trim());
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
