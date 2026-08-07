import { NextResponse } from "next/server";
import { listResistDoses, createResistDose } from "@/lib/admin-data";

export async function GET() {
  return NextResponse.json(listResistDoses());
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    resistType: string;
    referenceDoseUcCm2: number;
    notes?: string | null;
    referenceThicknessNm?: number | null;
  };
  if (!body.resistType?.trim() || typeof body.referenceDoseUcCm2 !== "number") {
    return NextResponse.json({ error: "resistType and referenceDoseUcCm2 required" }, { status: 400 });
  }
  try {
    createResistDose({ ...body, resistType: body.resistType.trim() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
