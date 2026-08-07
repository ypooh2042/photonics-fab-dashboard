import { NextResponse } from "next/server";
import { getReferenceData } from "@/lib/queue";

export async function GET() {
  return NextResponse.json(getReferenceData());
}
