import { NextResponse } from "next/server";
import { computeBatchExposureSummary } from "@/lib/chip-layout";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  try {
    return NextResponse.json(computeBatchExposureSummary(Number(jobId)));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
