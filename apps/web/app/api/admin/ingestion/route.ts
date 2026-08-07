import { NextResponse } from "next/server";
import { listIngestionState } from "@/lib/admin-data";

export async function GET() {
  return NextResponse.json(listIngestionState());
}
