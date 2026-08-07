import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const row = db
    .prepare("SELECT resolved_path FROM photos WHERE id = ?")
    .get(Number(id)) as { resolved_path: string } | undefined;

  if (!row || !fs.existsSync(row.resolved_path)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const ext = path.extname(row.resolved_path).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";
  const data = fs.readFileSync(row.resolved_path);

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
