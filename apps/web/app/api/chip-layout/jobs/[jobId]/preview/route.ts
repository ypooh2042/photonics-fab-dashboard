import { NextResponse } from "next/server";
import { generateJobPreviewSvgs } from "@/lib/chip-layout";

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  try {
    generateJobPreviewSvgs(Number(jobId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
