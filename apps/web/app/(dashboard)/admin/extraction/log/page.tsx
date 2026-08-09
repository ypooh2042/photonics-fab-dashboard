"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageContext";

interface Row {
  notePath: string;
  mtime: string;
  lastProcessedAt: string | null;
  status: string | null;
  error: string | null;
  consecutiveFailures: number;
}

export default function AdminExtractionLogPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const { lang, t } = useLanguage();

  function load() {
    setLoading(true);
    fetch("/api/admin/ingestion")
      .then((r) => r.json())
      .then((d) => {
        setRows(d);
        setLoading(false);
      });
  }

  useEffect(load, []);

  async function reprocess(notePath: string) {
    setReprocessing(notePath);
    setResultMsg(null);
    const res = await fetch("/api/admin/ingestion/reprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notePath }),
    });
    const data = await res.json();
    setReprocessing(null);
    setResultMsg(
      res.ok
        ? `${notePath}: ${t("reprocessDoneLabel")} (chip_runs ${data.chipRuns}, recipe_entries ${data.recipeEntries})`
        : `${notePath}: ${t("reprocessFailedLabel")} — ${data.error}`,
    );
    load();
  }

  if (loading) return <p className="opacity-60">{t("loadingEllipsis")}</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">
        {t("extractionLogLabel")} ({rows.length} {t("notesCountSuffix")})
      </h1>
      {resultMsg && <p className="text-sm mb-3 opacity-80">{resultMsg}</p>}
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div
            key={r.notePath}
            className="flex items-center gap-3 text-sm rounded-md border border-black/10 dark:border-white/15 px-3 py-2"
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                r.status === "success" ? "bg-green-500" : r.status === "error" ? "bg-red-500" : "bg-gray-400"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="truncate">{r.notePath}</p>
              {r.error && <p className="text-xs text-red-500 truncate">{r.error}</p>}
            </div>
            <span className="text-xs opacity-50 whitespace-nowrap">{r.lastProcessedAt}</span>
            {r.consecutiveFailures > 0 && (
              <span className="text-xs text-red-500">
                {lang === "ko"
                  ? `${t("failureCountLabel")} ${r.consecutiveFailures}${t("failureCountSuffix")}`
                  : `${r.consecutiveFailures} ${t("failureCountLabel")}`}
              </span>
            )}
            <button
              onClick={() => reprocess(r.notePath)}
              disabled={reprocessing === r.notePath}
              className="text-xs rounded-md border border-black/15 dark:border-white/20 px-2 py-1 hover:border-blue-500 disabled:opacity-50 whitespace-nowrap"
            >
              {reprocessing === r.notePath ? t("reprocessingLabel") : t("reprocessLabel")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
