import { NextResponse } from "next/server";
import { listPlacementInstances, createPlacementInstance } from "@/lib/chip-layout";

export async function GET(_request: Request, { params }: { params: Promise<{ exposureJobId: string }> }) {
  const { exposureJobId } = await params;
  try {
    return NextResponse.json(listPlacementInstances(Number(exposureJobId)));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ exposureJobId: string }> }) {
  const { exposureJobId } = await params;
  const body = (await request.json()) as {
    patternKey?: string;
    centerXUm?: number;
    centerYUm?: number;
  };
  if (!body.patternKey) {
    return NextResponse.json({ error: "patternKey required" }, { status: 400 });
  }
  try {
    const created = createPlacementInstance(Number(exposureJobId), {
      patternKey: body.patternKey,
      centerXUm: body.centerXUm,
      centerYUm: body.centerYUm,
    });
    return NextResponse.json(created);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
