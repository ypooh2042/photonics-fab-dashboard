import { NextResponse } from "next/server";
import { listPatternCandidates } from "@/lib/chip-layout";

/** Read-only pattern catalog for the batch's "패턴 목록" panel — deduped by layout name, layers unioned across same-named submissions. */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  try {
    return NextResponse.json(listPatternCandidates(Number(jobId)));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
