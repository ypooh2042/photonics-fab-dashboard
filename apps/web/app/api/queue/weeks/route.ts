import { NextResponse } from "next/server";
import { listWeeks } from "@/lib/queue";

export async function GET() {
  return NextResponse.json(listWeeks());
}
