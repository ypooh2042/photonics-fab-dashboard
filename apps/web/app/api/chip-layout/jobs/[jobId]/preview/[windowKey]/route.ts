import fs from "node:fs";
import { NextResponse } from "next/server";
import { getJobPreviewSvgPath } from "@/lib/chip-layout";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string; windowKey: string }> }) {
  const { jobId, windowKey } = await params;
  if (windowKey !== "A" && windowKey !== "B" && windowKey !== "D") {
    return NextResponse.json({ error: "invalid windowKey" }, { status: 400 });
  }
  const svgPath = getJobPreviewSvgPath(Number(jobId), windowKey);
  if (!fs.existsSync(svgPath)) {
    return NextResponse.json({ error: "이 window의 미리보기가 아직 생성되지 않았습니다" }, { status: 404 });
  }
  const svg = fs.readFileSync(svgPath, "utf-8");
  return NextResponse.json({ svg });
}
