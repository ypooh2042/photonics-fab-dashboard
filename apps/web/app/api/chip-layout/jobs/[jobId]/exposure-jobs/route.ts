import { NextResponse } from "next/server";
import { listExposureJobs, createExposureJob } from "@/lib/chip-layout";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  try {
    return NextResponse.json(listExposureJobs(Number(jobId)));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

/** Body is optional — the plain "Job 추가" button sends none, and createExposureJob fills in the standard default (5nA / 350µC/cm² / 8) for whatever's missing. */
export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const raw = await request.text();
  const body = raw ? (JSON.parse(raw) as { currentNa?: number; doseUcCm2?: number; scanStep?: number }) : {};
  try {
    const created = createExposureJob(Number(jobId), body);
    return NextResponse.json(created);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
