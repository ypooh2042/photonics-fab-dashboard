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
  const { lang, t } = useLanguage();

  function load() {
    fetch("/api/queue")
      .then((r) => r.json())
      .then(setData);
  }

  useEffect(load, []);

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
      <p className="text-sm opacity-60 mb-4">
        {formatWeekLabel(data.weekId)} {t("navQueue")} · {t("totalAvailableTimeLabel")}{" "}
        {Math.round(data.weeklyCapacityHours * 60)}
        {lang === "ko" ? "분" : " min"}
      </p>

      <div className="flex flex-col gap-6">
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
                    <button
                      onClick={(e) => onDelete(e, s)}
                      disabled={deletingId === s.id}
                      className="text-red-500 text-xs disabled:opacity-50 shrink-0"
                    >
                      {t("delete")}
                    </button>
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
