import { NextResponse } from "next/server";
import { createSubmission, type GridBounds } from "@/lib/queue";

interface SubmitBody {
  equipmentUserId: number;
  submittedBy: string;
  gdsFilename: string;
  gdsStoredPath: string;
  svgStoredPath?: string;
  exposureLayers: { layer: number; datatype: number }[];
  layerAreas: Record<string, number>;
  totalAreaUm2: number;
  resistType: string;
  ebeamCurrentNa: number;
  doseUcCm2: number;
  doseLabel?: string;
  gridBounds?: GridBounds;
  requestNotes?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as SubmitBody;

  if (typeof body.equipmentUserId !== "number") {
    return NextResponse.json({ error: "equipmentUserId required" }, { status: 400 });
  }
  if (!body.submittedBy?.trim()) {
    return NextResponse.json({ error: "submittedBy required" }, { status: 400 });
  }
  if (!body.exposureLayers?.length) {
    return NextResponse.json({ error: "select at least one exposure layer" }, { status: 400 });
  }
  if (!body.doseUcCm2 || body.doseUcCm2 <= 0) {
    return NextResponse.json({ error: "doseUcCm2 required" }, { status: 400 });
  }

  try {
    const result = createSubmission(body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
