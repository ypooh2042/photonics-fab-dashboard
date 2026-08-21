import fs from "node:fs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubmissionDetail, getWeeklySettings } from "@/lib/queue";
import LayoutGridPreview from "@/components/LayoutGridPreview";
import ExposureCompleteControl from "@/components/ExposureCompleteControl";
import { computeMinPixelResolution } from "@fab-dashboard/scheduling/resolution";
import { getServerLang } from "@/lib/i18n-server";
import { translate, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const COLOR_LABEL: Record<string, { key: "queueColorGreen" | "queueColorYellow" | "queueColorOrange"; className: string }> = {
  green: { key: "queueColorGreen", className: "text-green-600 dark:text-green-400" },
  yellow: { key: "queueColorYellow", className: "text-amber-500" },
  orange: { key: "queueColorOrange", className: "text-red-500" },
};

function fmtTime(seconds: number, lang: Lang): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return lang === "ko" ? `${m}분 ${s}초` : `${m}min ${s}sec`;
}

export default async function QueueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getSubmissionDetail(Number(id));
  if (!detail) notFound();
  const lang = await getServerLang();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, lang);

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
        ← {t("navQueue")}
      </Link>
      <div className="flex items-center justify-between gap-4 mt-2 mb-4 flex-wrap">
        <h1 className="text-xl font-semibold">
          {detail.submittedBy} · {detail.gdsFilename}
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          <ExposureCompleteControl submissionId={detail.id} status={detail.status} assignedWeekId={detail.assignedWeekId} />
          <a
            href={`/api/queue/${detail.id}/download`}
            className="text-sm rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 hover:border-blue-500 shrink-0"
          >
            {t("downloadLabel")}
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">{t("submittedDateLabel")}</p>
          <p className="font-medium">{detail.submittedAt}</p>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">{t("submitterLabel")}</p>
          <p className="font-medium">{detail.submittedBy}</p>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">{t("equipmentUserLabel")}</p>
          <p className="font-medium">
            {detail.equipmentUserName} ({detail.equipmentUserAlias})
          </p>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">{t("exposureLayerLabel")}</p>
          <p className="font-medium">
            {detail.exposureLayers.map((l) => `${l.layer}/${l.datatype}`).join(", ")}
          </p>
          <p className="opacity-60 text-xs mt-1">
            {t("totalAreaLabel")} {detail.totalAreaUm2.toLocaleString()} µm²
          </p>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">{t("estimatedExposureTimeLabel")}</p>
          <p className="font-medium">{fmtTime(detail.exposureTimeCalculatedS, lang)}</p>
          <p className="opacity-60 text-xs mt-1">
            {t("rangeLabel")}: {fmtTime(detail.exposureTimeMinS, lang)} ~ {fmtTime(detail.exposureTimeMaxS, lang)}
          </p>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">{t("resistDoseLabel")}</p>
          <p className="font-medium">
            {detail.doseLabel ?? detail.resistType} · {detail.doseUcCm2} µC/cm²
          </p>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">E-beam Current</p>
          <p className="font-medium">{detail.ebeamCurrentNa} nA</p>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
          <p className="opacity-60 mb-1">{t("resolutionShortLabel")}</p>
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
              {COLOR_LABEL[detail.color] ? t(COLOR_LABEL[detail.color].key) : detail.color}
            </p>
          </div>
        )}
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4 col-span-2">
          <p className="opacity-60 mb-1">{t("requestNotesLabel")}</p>
          <p className="font-medium whitespace-pre-wrap">{detail.requestNotes || t("noneLabel")}</p>
        </div>
      </div>

      {svg && detail.gridBounds && (
        <LayoutGridPreview svg={svg} visibleLayerKeys={visibleLayerKeys} gridBounds={detail.gridBounds} />
      )}
    </div>
  );
}
