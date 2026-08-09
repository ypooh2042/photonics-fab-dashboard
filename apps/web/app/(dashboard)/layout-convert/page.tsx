"use client";

import { useRef, useState } from "react";
import type { LayerArea } from "@/lib/gds-client";
import LayoutGridPreview, { type GridBounds } from "@/components/LayoutGridPreview";
import { useLanguage } from "@/components/LanguageContext";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

interface UploadInfo {
  uploadId: string;
  gdsFilename: string;
  gdsStoredPath: string;
  layers: LayerArea[];
}

interface ConvertResult {
  layers: LayerArea[];
  svg: string;
  gridBounds: GridBounds;
  downloadFilename: string;
}

export default function LayoutConvertPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<UploadInfo | null>(null);
  const [selectedLayers, setSelectedLayers] = useState<Set<string>>(new Set());
  const [isolationGap, setIsolationGap] = useState<number | "">("");
  const [converting, setConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);
  const [visibleResultLayers, setVisibleResultLayers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(t("fileTooLarge"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    setError(null);
    setConvertResult(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/layout-convert/upload", { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? t("uploadFailed"));
      return;
    }
    const data = await res.json();
    setUploadInfo(data);
    setSelectedLayers(new Set());
    setIsolationGap("");
  }

  function toggleLayer(key: string) {
    setSelectedLayers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleResultLayer(key: string) {
    setVisibleResultLayers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onCancelUpload() {
    if (uploadInfo) {
      await fetch("/api/layout-convert/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gdsStoredPath: uploadInfo.gdsStoredPath }),
      }).catch(() => {});
    }
    setUploadInfo(null);
    setSelectedLayers(new Set());
    setIsolationGap("");
    setConvertResult(null);
    setVisibleResultLayers(new Set());
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onConvert() {
    if (!uploadInfo || selectedLayers.size === 0 || typeof isolationGap !== "number" || isolationGap <= 0) return;
    setConverting(true);
    setError(null);
    setConvertResult(null);

    const res = await fetch("/api/layout-convert/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gdsStoredPath: uploadInfo.gdsStoredPath,
        gdsFilename: uploadInfo.gdsFilename,
        layers: [...selectedLayers],
        isolationGapUm: isolationGap,
      }),
    });
    setConverting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? t("convertFailed"));
      return;
    }
    const data = await res.json();
    setConvertResult({
      layers: data.layers,
      svg: data.svg,
      gridBounds: data.gridBounds,
      downloadFilename: data.downloadFilename,
    });
    setVisibleResultLayers(new Set(data.layers.map((l: LayerArea) => `${l.layer}:${l.datatype}`)));
  }

  const canConvert =
    !!uploadInfo && selectedLayers.size > 0 && typeof isolationGap === "number" && isolationGap > 0 && !converting;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-2">{t("navLayoutConvert")}</h1>
      <p className="text-sm opacity-70 mb-4">{t("layoutConvertDescription")}</p>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 text-sm">
          <span>{t("gdsFileLabel")}</span>
          <div className="flex items-center gap-2">
            <label
              htmlFor="layout-convert-file-input"
              className="cursor-pointer rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 w-fit transition-colors"
            >
              {t("chooseFileLabel")}
            </label>
            <input
              ref={fileInputRef}
              id="layout-convert-file-input"
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
            <p className="text-sm font-medium mb-2">{t("waveguideLayerSelectLabel")}</p>
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
          <label className="flex flex-col gap-1 text-sm">
            <span>{t("isolationGapLabel")}</span>
            <input
              type="number"
              min={0}
              step="any"
              value={isolationGap}
              onChange={(e) => setIsolationGap(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder={t("exampleValuePlaceholder")}
              className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
            />
          </label>
        )}

        {uploadInfo && (
          <button
            onClick={onConvert}
            disabled={!canConvert}
            className="rounded-md bg-blue-600 text-white py-2 disabled:opacity-50"
          >
            {converting ? t("converting") : t("confirm")}
          </button>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        {convertResult && (
          <>
            <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
              <p className="text-sm font-medium mb-2">{t("resultLayerDisplayLabel")}</p>
              <div className="flex flex-col gap-1">
                {convertResult.layers.map((l) => {
                  const key = `${l.layer}:${l.datatype}`;
                  return (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={visibleResultLayers.has(key)}
                        onChange={() => toggleResultLayer(key)}
                      />
                      <span>
                        Layer {l.layer}/{l.datatype}
                        {selectedLayers.has(key) ? t("convertedSuffix") : t("keptSuffix")} —{" "}
                        {l.area_um2.toLocaleString()} µm²
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <LayoutGridPreview
              svg={convertResult.svg}
              visibleLayerKeys={visibleResultLayers}
              gridBounds={convertResult.gridBounds}
            />
            <a
              href={`/api/layout-convert/download/${convertResult.downloadFilename}`}
              download
              className="rounded-md border border-black/15 dark:border-white/20 text-center py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              {t("downloadConvertedFile")}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
