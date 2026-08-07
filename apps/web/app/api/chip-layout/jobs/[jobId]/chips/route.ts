import { NextResponse } from "next/server";
import { listChips, createChip } from "@/lib/chip-layout";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return NextResponse.json(listChips(Number(jobId)));
}

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const body = (await request.json()) as { name?: string; windowKey?: string; widthUm?: number };
  if (!body.windowKey) return NextResponse.json({ error: "windowKey required" }, { status: 400 });
  try {
    const chip = createChip(Number(jobId), {
      name: body.name,
      windowKey: body.windowKey as "A" | "B" | "D",
      widthUm: body.widthUm,
    });
    return NextResponse.json(chip);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
