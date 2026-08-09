"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { estimateExposureTime } from "@fab-dashboard/scheduling/fcfs";
import { computeMinPixelResolution } from "@fab-dashboard/scheduling/resolution";
import type { LayerArea } from "@/lib/gds-client";
import LayoutGridPreview, { computeGridBounds, type GridBounds } from "@/components/LayoutGridPreview";
import { useLanguage } from "@/components/LanguageContext";
import type { Lang } from "@/lib/i18n";

interface ReferenceData {
  resists: { resist_type: string; reference_dose_uc_cm2: number; is_default: number }[];
  currents: { current_na: number; label: string; is_default: number }[];
  equipmentUsers: { id: number; name: string; alias: string }[];
  calibrationCostMinutes: number;
  perLayerCostSeconds: number;
  minDwellNs: number;
  dwellMarginRatio: number;
}

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

function defaultCurrentNa(currents: { current_na: number; is_default: number }[]): number | undefined {
  return currents.find((c) => c.is_default === 1)?.current_na ?? currents[0]?.current_na;
}

function defaultResist(resists: { resist_type: string; reference_dose_uc_cm2: number; is_default: number }[]) {
  return resists.find((r) => r.is_default === 1) ?? resists[0];
}

export default function SubmitPage() {
  const [ref, setRef] = useState<ReferenceData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<{
    uploadId: string;
    gdsFilename: string;
    gdsStoredPath: string;
    svgStoredPath: string;
    svg: string;
    layers: LayerArea[];
  } | null>(null);
  const [selectedLayers, setSelectedLayers] = useState<Set<string>>(new Set());
  const [equipmentUserId, setEquipmentUserId] = useState<number | "">("");
  const [resistType, setResistType] = useState("");
  const [doseUcCm2, setDoseUcCm2] = useState<number | "">("");
  const [currentNa, setCurrentNa] = useState<number | "">("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ color: string; timeCalculated: number; timeMin: number; timeMax: number } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, lang } = useLanguage();

  useEffect(() => {
    fetch("/api/submissions/reference-data")
      .then((r) => r.json())
      .then((d: ReferenceData) => {
        setRef(d);
        const initialResist = defaultResist(d.resists);
        if (initialResist) {
          setResistType(initialResist.resist_type);
          setDoseUcCm2(initialResist.reference_dose_uc_cm2);
        }
        const initialCurrent = defaultCurrentNa(d.currents);
        if (initialCurrent !== undefined) setCurrentNa(initialCurrent);
        if (d.equipmentUsers.length) setEquipmentUserId(d.equipmentUsers[0].id);
      });
  }, []);

  function onResistChange(newResistType: string) {
    setResistType(newResistType);
    const dose = ref?.resists.find((r) => r.resist_type === newResistType)?.reference_dose_uc_cm2;
    if (typeof dose === "number") setDoseUcCm2(dose);
  }

  const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (typeof equipmentUserId !== "number") {
      alert(t("selectEquipmentUserFirst"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(t("fileTooLarge"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    form.append("equipmentUserId", String(equipmentUserId));
    const res = await fetch("/api/submissions/upload", { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? t("uploadFailed"));
      return;
    }
    const data = await res.json();
    setUploadInfo(data);
    setSelectedLayers(new Set(data.layers.map((l: LayerArea) => `${l.layer}:${l.datatype}`)));
  }

  function toggleLayer(key: string) {
    setSelectedLayers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onCancelUpload() {
    // Once a submission has succeeded (`result` set), the GDS/SVG files are
    // now referenced by that queue entry — cancel must only reset this page,
    // not delete them. Only a still-unsubmitted upload gets its orphan files
    // deleted.
    if (uploadInfo && !result) {
      await fetch("/api/submissions/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gdsStoredPath: uploadInfo.gdsStoredPath, svgStoredPath: uploadInfo.svgStoredPath }),
      }).catch(() => {});
    }
    setUploadInfo(null);
    setSelectedLayers(new Set());
    setResult(null);
    setError(null);
    setSubmittedBy("");
    setRequestNotes("");
    const resetResist = ref ? defaultResist(ref.resists) : undefined;
    if (resetResist) {
      setResistType(resetResist.resist_type);
      setDoseUcCm2(resetResist.reference_dose_uc_cm2);
    }
    const resetCurrent = ref ? defaultCurrentNa(ref.currents) : undefined;
    if (resetCurrent !== undefined) setCurrentNa(resetCurrent);
    if (ref?.equipmentUsers.length) setEquipmentUserId(ref.equipmentUsers[0].id);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const totalAreaUm2 =
    uploadInfo?.layers
      .filter((l) => selectedLayers.has(`${l.layer}:${l.datatype}`))
      .reduce((sum, l) => sum + l.area_um2, 0) ?? 0;

  const gridBounds: GridBounds | null = useMemo(() => {
    if (!uploadInfo) return null;
    const selected = uploadInfo.layers.filter((l) => selectedLayers.has(`${l.layer}:${l.datatype}`));
    if (selected.length === 0) return null;
    const bbox = selected.reduce(
      (acc, l) => ({
        xmin: Math.min(acc.xmin, l.bbox.xmin),
        ymin: Math.min(acc.ymin, l.bbox.ymin),
        xmax: Math.max(acc.xmax, l.bbox.xmax),
        ymax: Math.max(acc.ymax, l.bbox.ymax),
      }),
      { xmin: Infinity, ymin: Infinity, xmax: -Infinity, ymax: -Infinity },
    );
    return computeGridBounds(bbox);
  }, [uploadInfo, selectedLayers]);

  const liveEstimate =
    ref && typeof doseUcCm2 === "number" && doseUcCm2 > 0 && typeof currentNa === "number" && selectedLayers.size > 0
      ? estimateExposureTime({
          areaUm2: totalAreaUm2,
          doseUcCm2,
          currentNa,
          layerCount: selectedLayers.size,
          calibrationSeconds: ref.calibrationCostMinutes * 60,
          perLayerSeconds: ref.perLayerCostSeconds,
        })
      : null;

  const pixelResolution =
    ref && typeof doseUcCm2 === "number" && doseUcCm2 > 0 && typeof currentNa === "number"
      ? computeMinPixelResolution({
          doseUcCm2,
          currentNa,
          minDwellNs: ref.minDwellNs,
          dwellMarginRatio: ref.dwellMarginRatio,
        })
      : null;

  async function onSubmit() {
    if (!uploadInfo || typeof currentNa !== "number" || !submittedBy.trim()) return;
    if (typeof doseUcCm2 !== "number" || doseUcCm2 <= 0) return;
    if (typeof equipmentUserId !== "number") return;
    setSubmitting(true);
    setError(null);

    const exposureLayers = uploadInfo.layers.filter((l) =>
      selectedLayers.has(`${l.layer}:${l.datatype}`),
    );
    const layerAreas = Object.fromEntries(
      exposureLayers.map((l) => [`${l.layer}:${l.datatype}`, l.area_um2]),
    );

    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipmentUserId,
        submittedBy,
        gdsFilename: uploadInfo.gdsFilename,
        gdsStoredPath: uploadInfo.gdsStoredPath,
        svgStoredPath: uploadInfo.svgStoredPath,
        exposureLayers: exposureLayers.map((l) => ({ layer: l.layer, datatype: l.datatype })),
        layerAreas,
        totalAreaUm2,
        resistType,
        doseUcCm2,
        ebeamCurrentNa: currentNa,
        gridBounds,
        requestNotes,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? t("submitFailed"));
      return;
    }
    const data = await res.json();
    setResult({
      color: data.color,
      timeCalculated: data.exposureTimeCalculatedS,
      timeMin: data.exposureTimeMinS,
      timeMax: data.exposureTimeMaxS,
    });
    alert(
      `${t("submitSuccessAlert")}\n\n${t("estimatedExposureTimeLabel")}: ${fmtTime(data.exposureTimeCalculatedS, lang)}\n(${t("rangeLabel")}: ${fmtTime(data.exposureTimeMinS, lang)} ~ ${fmtTime(data.exposureTimeMaxS, lang)})`,
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">{t("navSubmit")}</h1>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("equipmentUserLabel")}</span>
          <select
            value={equipmentUserId}
            onChange={(e) => setEquipmentUserId(e.target.value === "" ? "" : Number(e.target.value))}
            className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
          >
            {ref?.equipmentUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.alias})
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span>{t("gdsFileLabel")}</span>
          <div className="flex items-center gap-2">
            <label
              htmlFor="gds-file-input"
              className="cursor-pointer rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 w-fit transition-colors"
            >
              {t("chooseFileLabel")}
            </label>
            <input
              ref={fileInputRef}
              id="gds-file-input"
              type="file"
              accept=".gds,.gds2,.oas"
              onChange={onFileChange}
              className="hidden"
            />
            {uploadInfo && <span className="text-sm opacity-70 truncate max-w-[220px]">{uploadInfo.gdsFilename}</span>}
            {uploadInfo && (
              <button
                type="button"
                onClick={onCancelUpload}
                className="text-red-500 text-xs border border-red-500/40 rounded px-2 py-1 hover:bg-red-500/10 shrink-0"
              >
                {t("cancel")}
              </button>
            )}
          </div>
        </div>
        {uploading && <p className="text-sm opacity-60">{t("analyzingLayers")}</p>}

        {uploadInfo && (
          <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
            <p className="text-sm font-medium mb-2">{t("selectExposureLayers")}</p>
            <div className="flex flex-col gap-1">
              {uploadInfo.layers.map((l) => {
                const key = `${l.layer}:${l.datatype}`;
                return (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedLayers.has(key)}
                      onChange={() => toggleLayer(key)}
                    />
                    <span>
                      Layer {l.layer}/{l.datatype} — {l.area_um2.toLocaleString()} µm²
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {uploadInfo && (
          <LayoutGridPreview svg={uploadInfo.svg} visibleLayerKeys={selectedLayers} gridBounds={gridBounds} />
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span>{t("resistLabel")}</span>
          <select
            value={resistType}
            onChange={(e) => onResistChange(e.target.value)}
            className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
          >
            {ref?.resists.map((r) => (
              <option key={r.resist_type} value={r.resist_type}>
                {r.resist_type} ({t("referenceDoseInline")} {r.reference_dose_uc_cm2} µC/cm²)
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span>{t("doseLabel")}</span>
          <input
            type="number"
            min={0}
            step="any"
            value={doseUcCm2}
            onChange={(e) => setDoseUcCm2(e.target.value === "" ? "" : Number(e.target.value))}
            className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span>{t("currentLabel")}</span>
          <select
            value={currentNa}
            onChange={(e) => setCurrentNa(Number(e.target.value))}
            className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
          >
            {ref?.currents.map((c) => (
              <option key={c.current_na} value={c.current_na}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span>{t("resolutionLabel")}</span>
          <div className="rounded-md border border-black/15 dark:border-white/20 bg-black/[.03] dark:bg-white/[.05] px-3 py-2 opacity-80">
            {pixelResolution
              ? `pixel size ${pixelResolution.pixelSizeNm}nm × ${pixelResolution.pixelSizeNm}nm (step size: ${pixelResolution.stepSize})`
              : "-"}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span>{t("requesterNameLabel")}</span>
          <input
            value={submittedBy}
            onChange={(e) => setSubmittedBy(e.target.value)}
            placeholder={t("nameLabel")}
            className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span>{t("requestNotesLabel")}</span>
          <textarea
            value={requestNotes}
            onChange={(e) => setRequestNotes(e.target.value)}
            placeholder={t("requestNotesPlaceholder")}
            rows={3}
            className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
          />
        </label>

        {liveEstimate && (
          <div className="rounded-lg border border-black/10 dark:border-white/15 p-4 text-sm">
            <p>
              {t("selectedAreaLabel")}: {totalAreaUm2.toLocaleString()} µm²
            </p>
            <p>
              {t("estimatedExposureTimeLabel")}: {fmtTime(liveEstimate.timeCalculatedSeconds, lang)}
              <span className="opacity-50">
                {" "}
                ({t("rangeLabel")}: {fmtTime(liveEstimate.timeMinSeconds, lang)} ~{" "}
                {fmtTime(liveEstimate.timeMaxSeconds, lang)}, -10%~+20%)
              </span>
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={onSubmit}
          disabled={
            !uploadInfo ||
            submitting ||
            !submittedBy.trim() ||
            selectedLayers.size === 0 ||
            typeof doseUcCm2 !== "number" ||
            doseUcCm2 <= 0 ||
            typeof equipmentUserId !== "number"
          }
          className="rounded-md bg-blue-600 text-white py-2 disabled:opacity-50"
        >
          {submitting ? t("submitting") : t("submitButton")}
        </button>

        {result && (
          <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
            <p className={`font-medium ${COLOR_LABEL[result.color]?.className}`}>
              {COLOR_LABEL[result.color] ? t(COLOR_LABEL[result.color].key) : result.color}
            </p>
            <p className="text-sm opacity-70 mt-1">
              {t("confirmedTimeLabel")}: {fmtTime(result.timeCalculated, lang)}
              <span className="opacity-50">
                {" "}
                ({t("rangeLabel")}: {fmtTime(result.timeMin, lang)} ~ {fmtTime(result.timeMax, lang)})
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
