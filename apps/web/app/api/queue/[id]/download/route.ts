import fs from "node:fs";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const row = db
    .prepare("SELECT gds_filename, gds_stored_path FROM layout_submissions WHERE id = ?")
    .get(Number(id)) as { gds_filename: string; gds_stored_path: string } | undefined;

  if (!row || !fs.existsSync(row.gds_stored_path)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(row.gds_stored_path);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${row.gds_filename}"`,
    },
  });
}
