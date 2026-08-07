import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { convertToPositive } from "@/lib/gds-client";
import { sweepOldFiles } from "@/lib/scratch-cleanup";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    gdsStoredPath?: string;
    gdsFilename?: string;
    layers?: string[];
    isolationGapUm?: number;
  };
  const { gdsStoredPath, gdsFilename, layers, isolationGapUm } = body;
  if (!gdsStoredPath || !layers || layers.length === 0 || !isolationGapUm || isolationGapUm <= 0) {
    return NextResponse.json(
      { error: "gdsStoredPath, layers(1개 이상), isolationGapUm(>0) required" },
      { status: 400 },
    );
  }

  const uploadsDir = path.resolve(process.cwd(), "../../data/layout-convert-uploads");
  const resolved = path.resolve(gdsStoredPath);
  if (!resolved.startsWith(uploadsDir + path.sep)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(resolved);
  } catch {
    return NextResponse.json({ error: "업로드된 파일을 찾을 수 없습니다. 다시 업로드해주세요." }, { status: 400 });
  }

  let result;
  try {
    result = await convertToPositive(buffer, gdsFilename ?? "layout.gds", layers, isolationGapUm);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const convertedDir = path.join(uploadsDir, "converted");
  fs.mkdirSync(convertedDir, { recursive: true });
  sweepOldFiles(uploadsDir);
  sweepOldFiles(convertedDir);
  const convertedId = crypto.randomUUID();
  const baseExt = path.extname(gdsFilename ?? ".gds") || ".gds";
  const baseName = path
    .basename(gdsFilename ?? "layout", baseExt)
    .replace(/[^a-zA-Z0-9가-힣_.-]/g, "_")
    .slice(0, 100);
  const convertedFilename = `${baseName}_positive__${convertedId.slice(0, 8)}.gds`;
  const convertedPath = path.join(convertedDir, convertedFilename);
  fs.writeFileSync(convertedPath, Buffer.from(result.gdsBase64, "base64"));

  return NextResponse.json({
    layers: result.layers,
    svg: result.svg,
    overallBbox: result.overallBbox,
    gridBounds: result.gridBounds,
    downloadFilename: convertedFilename,
  });
}
