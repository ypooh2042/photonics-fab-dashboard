import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const convertedDir = path.resolve(process.cwd(), "../../data/layout-convert-uploads/converted");
  const resolved = path.join(convertedDir, path.basename(filename));

  if (!resolved.startsWith(convertedDir + path.sep) || !fs.existsSync(resolved)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(resolved);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${path.basename(filename)}"`,
    },
  });
}
