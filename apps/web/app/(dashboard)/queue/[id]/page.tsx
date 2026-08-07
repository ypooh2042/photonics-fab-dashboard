import fs from "node:fs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubmissionDetail, getWeeklySettings } from "@/lib/queue";
import LayoutGridPreview from "@/components/LayoutGridPreview";
import { computeMinPixelResolution } from "@fab-dashboard/scheduling/resolution";

export const dynamic = "force-dynamic";

const COLOR_LABEL: Record<string, { text: string; className: string }> = {
  green: { text: "이번 주 확정 가능", className: "text-green-600 dark:text-green-400" },
  yellow: { text: "여유 있으면 확정, 아니면 다음 주로 이월될 수 있음", className: "text-amber-500" },
  orange: { text: "이번 주는 어려울 가능성 높음 (다음 주로 이월)", className: "text-red-500" },
};

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}분 ${s}초`;
}

export default async function QueueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getSubmissionDetail(Number(id));
  if (!detail) notFound();

  const svg = detail.svgStoredPath && fs.existsSync(detail.svgStoredPath) ? fs.readFileSync(detail.svgStoredPath, "utf-8") : null;
  const visibleLayerKeys = new Set(detail.exposureLayers.map((l) => `${l.layer}:${l.datatype}`));
  const settings = getWeeklySettings();
  const pixelResolution = computeMinPixelResolution({
    doseUcCm2: detail.doseUcCm2,
    currentNa: detail.ebeamCurrentNa,
    minDwellNs: settings.minDwellNs,
    dwellMarginRatio: settings.dwellMarginRatio,
  });

  return (
    <div className="max-w-3xl">
      <Link href="/queue" className="text-sm opacity-60 hover:opacity-100">
        ← 노광 큐
      </Link>
      <div className="flex items-center justify-between gap-4 mt-2 mb-4 flex-wrap">
        <h1 className="text-xl font-semibold">
          {detail.submittedBy} · {detail.gdsFilename}
        </h1>
        <a
          href={`/api/queue/${detail.id}/download`}
          className="text-sm rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 hover:border-blue-500 shrink-0"
        >
          다운로드
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">신청 날짜</p>
          <p className="font-medium">{detail.submittedAt}</p>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">신청자</p>
          <p className="font-medium">{detail.submittedBy}</p>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">장비 사용자</p>
          <p className="font-medium">
            {detail.equipmentUserName} ({detail.equipmentUserAlias})
          </p>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">노광 레이어</p>
          <p className="font-medium">
            {detail.exposureLayers.map((l) => `${l.layer}/${l.datatype}`).join(", ")}
          </p>
          <p className="opacity-60 text-xs mt-1">총 면적 {detail.totalAreaUm2.toLocaleString()} µm²</p>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">예상 노광 시간</p>
          <p className="font-medium">{fmtTime(detail.exposureTimeCalculatedS)}</p>
          <p className="opacity-60 text-xs mt-1">
            범위: {fmtTime(detail.exposureTimeMinS)} ~ {fmtTime(detail.exposureTimeMaxS)}
          </p>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">레지스트 / Dose</p>
          <p className="font-medium">
            {detail.doseLabel ?? detail.resistType} · {detail.doseUcCm2} µC/cm²
          </p>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">E-beam Current</p>
          <p className="font-medium">{detail.ebeamCurrentNa} nA</p>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">노광 해상도</p>
          <p className="font-medium">
            pixel size {pixelResolution.pixelSizeNm}nm × {pixelResolution.pixelSizeNm}nm (step size:{" "}
            {pixelResolution.stepSize})
          </p>
        </div>
        {detail.gridBounds && (
          <div className="rounded-lg border border-black/10 dark:border-white/15 p-4 col-span-2">
            <p className="opacity-60 mb-1">Grid size</p>
            <p className="font-medium">
              ({detail.gridBounds.leftUm.toFixed(0)}, {detail.gridBounds.bottomUm.toFixed(0)}) ~ (
              {detail.gridBounds.rightUm.toFixed(0)}, {detail.gridBounds.topUm.toFixed(0)})
            </p>
          </div>
        )}
        {detail.color && (
          <div className="rounded-lg border border-black/10 dark:border-white/15 p-4 col-span-2">
            <p className={`font-medium ${COLOR_LABEL[detail.color]?.className ?? ""}`}>
              {COLOR_LABEL[detail.color]?.text ?? detail.color}
            </p>
          </div>
        )}
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4 col-span-2">
          <p className="opacity-60 mb-1">요청사항</p>
          <p className="font-medium whitespace-pre-wrap">{detail.requestNotes || "(없음)"}</p>
        </div>
      </div>

      {svg && detail.gridBounds && (
        <LayoutGridPreview svg={svg} visibleLayerKeys={visibleLayerKeys} gridBounds={detail.gridBounds} />
      )}
    </div>
  );
}
