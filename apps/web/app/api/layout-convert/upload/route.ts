import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { analyzeGds } from "@/lib/gds-client";
import { sweepOldFiles } from "@/lib/scratch-cleanup";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "파일 용량이 너무 큽니다!" }, { status: 400 });
  }

  let analysis;
  try {
    analysis = await analyzeGds(file);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const uploadId = crypto.randomUUID();
  const uploadsDir = path.resolve(process.cwd(), "../../data/layout-convert-uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  sweepOldFiles(uploadsDir);
  sweepOldFiles(path.join(uploadsDir, "converted"));
  const ext = path.extname(file.name) || ".gds";
  const baseName = path
    .basename(file.name, ext)
    .replace(/[^a-zA-Z0-9가-힣_.-]/g, "_")
    .slice(0, 100);
  const stem = `${baseName}__${uploadId.slice(0, 8)}`;
  const storedPath = path.join(uploadsDir, `${stem}${ext}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(storedPath, buffer);

  return NextResponse.json({
    uploadId,
    gdsFilename: file.name,
    gdsStoredPath: storedPath,
    layers: analysis.layers,
  });
}

// Cancels an upload that was never converted — deletes the GDS file this
// route just wrote to disk.
export async function DELETE(request: Request) {
  const { gdsStoredPath } = (await request.json()) as { gdsStoredPath?: string };
  const uploadsDir = path.resolve(process.cwd(), "../../data/layout-convert-uploads");

  if (gdsStoredPath) {
    const resolved = path.resolve(gdsStoredPath);
    if (resolved.startsWith(uploadsDir + path.sep)) {
      fs.rmSync(resolved, { force: true });
    }
  }

  return NextResponse.json({ ok: true });
}
