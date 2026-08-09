"use client";

import { useEffect, useState } from "react";
import LayoutGridPreview from "./LayoutGridPreview";
import { useLanguage } from "@/components/LanguageContext";

type WindowKey = "A" | "B" | "D";

interface Props {
  jobId: number;
  jobName: string;
  windowOptions: WindowKey[];
  initialWindowKey: WindowKey;
  onClose: () => void;
}

/** Edit-mode counterpart to the view-mode preview page — same SVG endpoint, but rendered as an overlay so closing it drops straight back into editing instead of navigating away. */
export default function ChipLayoutPreviewModal({ jobId, jobName, windowOptions, initialWindowKey, onClose }: Props) {
  const [windowKey, setWindowKey] = useState<WindowKey>(initialWindowKey);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    setSvg(null);
    setError(null);
    fetch(`/api/chip-layout/jobs/${jobId}/preview/${windowKey}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setError(d.error ?? t("loadFailed"));
          return;
        }
        setSvg(d.svg);
      })
      .catch(() => setError(t("loadFailed")));
  }, [jobId, windowKey]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            {jobName} · {t("fullPatternViewLabel")}
          </h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm">
              Window
              <select
                value={windowKey}
                onChange={(e) => setWindowKey(e.target.value as WindowKey)}
                className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
              >
                {windowOptions.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={onClose}
              className="rounded-md border border-black/15 dark:border-white/20 px-2 py-1 text-sm"
            >
              {t("close")}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {svg && <LayoutGridPreview svg={svg} visibleLayerKeys={new Set()} gridBounds={null} showFieldGrid={false} />}
      </div>
    </div>
  );
}
