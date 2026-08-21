"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatWeekLabel } from "@fab-dashboard/scheduling/week-boundary";
import { useLanguage } from "@/components/LanguageContext";

interface Submission {
  id: number;
  submittedBy: string;
  submittedAt: string;
  gdsFilename: string;
  resistType: string;
  doseLabel: string | null;
  ebeamCurrentNa: number;
  exposureTimeCalculatedS: number;
  exposureTimeMinS: number;
  exposureTimeMaxS: number;
  status: string;
  color: string | null;
}

interface QueueSection {
  equipmentUserId: number;
  equipmentUserName: string;
  equipmentUserAlias: string;
  isPermanent: boolean;
  capacityHours: number;
  totalLoadingMinutes: number;
  totalExposureMinutes: number;
  totalExposureMaxMinutes: number;
  totalExpectedMinutes: number;
  totalExpectedMaxMinutes: number;
  submissions: Submission[];
}

interface WeekSummary {
  weekId: string;
  label: string;
  isOpen: boolean;
}

const COLOR_DOT: Record<string, string> = {
  green: "bg-green-500",
  yellow: "bg-amber-400",
  orange: "bg-red-500",
};

function fmtTime(seconds: number, lang: "ko" | "en"): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return lang === "ko" ? `${m}분 ${s}초` : `${m}min ${s}sec`;
}

interface QueueData {
  weekId: string;
  weeklyCapacityHours: number;
  sections: QueueSection[];
}

export default function QueueTable() {
  const [data, setData] = useState<QueueData | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewingOpen, setViewingOpen] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [weeks, setWeeks] = useState<WeekSummary[] | null>(null);
  const { lang, t } = useLanguage();

  function load(weekId?: string) {
    const url = weekId ? `/api/queue?week=${encodeURIComponent(weekId)}` : "/api/queue";
    fetch(url)
      .then((r) => r.json())
      .then(setData);
  }

  useEffect(() => load(), []);

  function toggleWeekPicker() {
    if (!pickerOpen && !weeks) {
      fetch("/api/queue/weeks")
        .then((r) => r.json())
        .then(setWeeks);
    }
    setPickerOpen((o) => !o);
  }

  function selectWeek(w: WeekSummary) {
    load(w.weekId);
    setViewingOpen(w.isOpen);
    setPickerOpen(false);
  }

  function backToCurrentWeek() {
    load();
    setViewingOpen(true);
  }

  async function onDelete(e: React.MouseEvent, s: Submission) {
    e.preventDefault();
    e.stopPropagation();
    const quoted = `"${s.submittedBy} · ${s.gdsFilename}"`;
    const confirmMsg = lang === "ko" ? `${quoted} ${t("confirmDeleteQueueEntry")}` : `Delete submission ${quoted} from the queue?`;
    if (!confirm(confirmMsg)) return;
    setDeletingId(s.id);
    await fetch(`/api/queue/${s.id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  }

  if (!data) return <p className="opacity-60">{t("loadingEllipsis")}</p>;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <p className="text-sm opacity-60">
          {formatWeekLabel(data.weekId)} {t("navQueue")} · {t("totalAvailableTimeLabel")}{" "}
          {Math.round(data.weeklyCapacityHours * 60)}
          {lang === "ko" ? "분" : " min"}
        </p>
        <div className="relative">
          <button
            onClick={toggleWeekPicker}
            className="text-xs rounded-md border border-black/15 dark:border-white/20 px-2 py-1 opacity-70 hover:opacity-100"
          >
            {t("pastExposureListsLabel")}
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-56 max-h-72 overflow-y-auto rounded-md border border-black/15 dark:border-white/20 bg-white dark:bg-neutral-900 py-1 shadow-lg">
                {weeks === null ? (
                  <p className="px-3 py-2 text-xs opacity-60">{t("loadingEllipsis")}</p>
                ) : weeks.length === 0 ? (
                  <p className="px-3 py-2 text-xs opacity-60">{t("noWeeksYet")}</p>
                ) : (
                  weeks.map((w) => (
                    <button
                      key={w.weekId}
                      onClick={() => selectWeek(w)}
                      className="block w-full px-3 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      {w.label}
                      {w.isOpen && <span className="opacity-50"> ({t("currentWeekTag")})</span>}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {!viewingOpen && (
        <div className="flex items-center gap-2 mb-4 text-xs">
          <span className="text-amber-500">{t("viewingCompletedWeekNotice")}</span>
          <button onClick={backToCurrentWeek} className="underline opacity-70 hover:opacity-100">
            {t("backToCurrentWeekLabel")}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6 mt-4">
        {data.sections.map((section) => (
          <div key={section.equipmentUserId}>
            <div className="flex items-baseline gap-2 mb-1">
              <h2 className="text-base font-semibold">
                {section.equipmentUserName} ({section.equipmentUserAlias})
              </h2>
              <Link
                href={`/chip-layout/${section.equipmentUserId}`}
                className="text-xs rounded-md border border-black/15 dark:border-white/20 px-2 py-0.5 opacity-70 hover:opacity-100"
              >
                {t("jobSettingsLink")}
              </Link>
            </div>
            <p className="text-sm opacity-60 mb-3">
              {t("availableTimeLabel")} {Math.round(section.capacityHours * 60)}
              {lang === "ko" ? "분, " : " min, "}
              {t("chipLoadingTimeLabel")} {Math.round(section.totalLoadingMinutes)}
              {lang === "ko" ? "분" : " min"}
            </p>

            {section.submissions.length === 0 ? (
              <p className="text-sm opacity-60">{t("noSubmissionsThisWeek")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {section.submissions.map((s, i) => (
                  <Link
                    key={s.id}
                    href={`/queue/${s.id}`}
                    className="flex items-center gap-3 rounded-lg border border-black/10 dark:border-white/15 px-4 py-3 hover:bg-black/[.03] dark:hover:bg-white/[.05]"
                  >
                    <span className="text-xs opacity-40 w-5">{i + 1}</span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_DOT[s.color ?? ""] ?? "bg-gray-400"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {s.submittedBy} · {s.gdsFilename}
                      </p>
                      <p className="text-xs opacity-60">
                        {s.doseLabel ?? s.resistType} · {s.ebeamCurrentNa}nA ·{" "}
                        {fmtTime(s.exposureTimeCalculatedS, lang)}
                        <span className="opacity-70">
                          {" "}
                          ({t("rangeLabel")}: {fmtTime(s.exposureTimeMinS, lang)} ~ {fmtTime(s.exposureTimeMaxS, lang)})
                        </span>
                      </p>
                    </div>
                    <span className="text-xs opacity-50 whitespace-nowrap">{s.submittedAt}</span>
                    {viewingOpen && (
                      <button
                        onClick={(e) => onDelete(e, s)}
                        disabled={deletingId === s.id}
                        className="text-red-500 text-xs disabled:opacity-50 shrink-0"
                      >
                        {t("delete")}
                      </button>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
