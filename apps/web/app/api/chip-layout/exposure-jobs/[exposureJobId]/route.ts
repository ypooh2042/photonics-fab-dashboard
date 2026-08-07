import { NextResponse } from "next/server";
import { updateExposureJob, deleteExposureJob } from "@/lib/chip-layout";

export async function PATCH(request: Request, { params }: { params: Promise<{ exposureJobId: string }> }) {
  const { exposureJobId } = await params;
  const body = await request.json();
  try {
    const updated = updateExposureJob(Number(exposureJobId), body);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ exposureJobId: string }> }) {
  const { exposureJobId } = await params;
  try {
    deleteExposureJob(Number(exposureJobId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
