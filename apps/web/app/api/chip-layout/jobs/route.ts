import { NextResponse } from "next/server";
import { listJobs, createJob, type CassetteType } from "@/lib/chip-layout";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const equipmentUserId = Number(searchParams.get("equipmentUserId"));
  if (!equipmentUserId) return NextResponse.json({ error: "equipmentUserId required" }, { status: 400 });
  return NextResponse.json(listJobs(equipmentUserId));
}

export async function POST(request: Request) {
  const body = (await request.json()) as { equipmentUserId?: number; name?: string; cassetteType?: CassetteType };
  if (!body.equipmentUserId) return NextResponse.json({ error: "equipmentUserId required" }, { status: 400 });
  try {
    const job = createJob(body.equipmentUserId, body.name, body.cassetteType);
    return NextResponse.json(job);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
