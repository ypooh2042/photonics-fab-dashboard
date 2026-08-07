import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { uploadPhotoToStage } from "@/lib/admin-data";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".bmp", ".pdf"]);

export async function POST(request: Request, { params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "파일 용량이 너무 큽니다 (최대 20MB)." }, { status: 400 });
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: "지원하지 않는 파일 형식입니다 (jpg/png/bmp/pdf만 가능)." }, { status: 400 });
  }

  const uploadsDir = path.resolve(process.cwd(), "../../data/admin-photo-uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const baseName = path
    .basename(file.name, ext)
    .replace(/[^a-zA-Z0-9가-힣_.-]/g, "_")
    .slice(0, 100);
  const storedFilename = `${baseName}__${crypto.randomUUID().slice(0, 8)}${ext}`;
  const storedPath = path.join(uploadsDir, storedFilename);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(storedPath, buffer);

  try {
    const id = uploadPhotoToStage(Number(stageId), storedFilename, storedPath, buffer.length);
    return NextResponse.json({ id });
  } catch (err) {
    fs.rmSync(storedPath, { force: true });
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
