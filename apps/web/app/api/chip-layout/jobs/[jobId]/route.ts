import { NextResponse } from "next/server";
import { getJob, updateJob, deleteJob } from "@/lib/chip-layout";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getJob(Number(jobId));
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(job);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const body = await request.json();
  try {
    const job = updateJob(Number(jobId), body);
    return NextResponse.json(job);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  deleteJob(Number(jobId));
  return NextResponse.json({ ok: true });
}
