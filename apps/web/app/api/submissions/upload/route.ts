import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { analyzeGds } from "@/lib/gds-client";
import { getActiveWeekId } from "@/lib/queue";
import { getEquipmentUser } from "@/lib/equipment-users";
import { weekFolderName } from "@fab-dashboard/scheduling/week-boundary";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const equipmentUserIdRaw = form.get("equipmentUserId");
  const equipmentUserId = typeof equipmentUserIdRaw === "string" ? Number(equipmentUserIdRaw) : NaN;
  const equipmentUser = Number.isFinite(equipmentUserId) ? getEquipmentUser(equipmentUserId) : null;
  if (!equipmentUser) {
    return NextResponse.json({ error: "valid equipmentUserId required" }, { status: 400 });
  }

  let analysis;
  try {
    analysis = await analyzeGds(file);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const uploadId = crypto.randomUUID();
  // Files are grouped by whichever queue week is currently open (the week a
  // submission created right now would land in) so they end up alongside
  // the other GDS/SVG files for that same week's queue.
  const weekFolder = weekFolderName(getActiveWeekId());
  const uploadsDir = path.resolve(process.cwd(), "../../data/gds-uploads", weekFolder);
  const svgDir = path.join(uploadsDir, "svg");
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(svgDir, { recursive: true });
  const ext = path.extname(file.name) || ".gds";
  const baseName = path
    .basename(file.name, ext)
    .replace(/[^a-zA-Z0-9가-힣_.-]/g, "_")
    .slice(0, 100);
  const stem = `${equipmentUser.alias}_${baseName}__${uploadId.slice(0, 8)}`;
  const storedPath = path.join(uploadsDir, `${stem}${ext}`);
  const svgStoredPath = path.join(svgDir, `${stem}.svg`);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(storedPath, buffer);
  fs.writeFileSync(svgStoredPath, analysis.svg);

  return NextResponse.json({
    uploadId,
    gdsFilename: file.name,
    gdsStoredPath: storedPath,
    svgStoredPath,
    layers: analysis.layers,
    svg: analysis.svg,
    overallBbox: analysis.overall_bbox,
  });
}

// Cancels an upload that was never submitted — deletes the GDS+SVG files
// this route just wrote to disk. Only ever called before any submission
// row references these paths, so no "still referenced elsewhere" check is
// needed (unlike deleteSubmission, which handles the post-submission case).
export async function DELETE(request: Request) {
  const { gdsStoredPath, svgStoredPath } = (await request.json()) as {
    gdsStoredPath?: string;
    svgStoredPath?: string;
  };
  const uploadsDir = path.resolve(process.cwd(), "../../data/gds-uploads");

  for (const p of [gdsStoredPath, svgStoredPath]) {
    if (!p) continue;
    const resolved = path.resolve(p);
    if (resolved.startsWith(uploadsDir + path.sep)) {
      fs.rmSync(resolved, { force: true });
    }
  }

  return NextResponse.json({ ok: true });
}
