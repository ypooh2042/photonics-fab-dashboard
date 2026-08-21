"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatWeekLabel } from "@fab-dashboard/scheduling/week-boundary";
import { useLanguage } from "@/components/LanguageContext";

interface WeekSummary {
  weekId: string;
  label: string;
  isOpen: boolean;
}

interface Props {
  submissionId: number;
  status: string;
  assignedWeekId: string;
}

export default function ExposureCompleteControl({ submissionId, status, assignedWeekId }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [weeks, setWeeks] = useState<WeekSummary[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();

  if (status === "completed") {
    return (
      <p className="text-sm font-medium text-green-600 dark:text-green-400">
        {t("completedInWeekLabel")} · {formatWeekLabel(assignedWeekId)}
      </p>
    );
  }

  function openPicker() {
    if (!window.confirm(t("confirmExposureCompleteWarning"))) return;
    if (!weeks) {
      fetch("/api/queue/weeks")
        .then((r) => r.json())
        .then(setWeeks);
    }
    setPickerOpen(true);
  }

  async function selectWeek(w: WeekSummary) {
    setSubmitting(true);
    const res = await fetch(`/api/queue/${submissionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekId: w.weekId }),
    });
    setSubmitting(false);
    setPickerOpen(false);
    if (!res.ok) {
      alert(t("completeSubmissionFailed"));
      return;
    }
    router.refresh();
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={openPicker}
        disabled={submitting}
        className="text-sm rounded-md border border-green-600/50 text-green-600 dark:text-green-400 px-3 py-1.5 hover:bg-green-600/10 disabled:opacity-50 shrink-0"
      >
        {t("exposureCompleteLabel")}
      </button>
      {pickerOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-64 max-h-72 overflow-y-auto rounded-md border border-black/15 dark:border-white/20 bg-white dark:bg-neutral-900 py-1 shadow-lg">
            <p className="px-3 py-1.5 text-xs opacity-60">{t("selectCompletionWeekLabel")}</p>
            {weeks === null ? (
              <p className="px-3 py-2 text-xs opacity-60">{t("loadingEllipsis")}</p>
            ) : (
              weeks.map((w) => (
                <button
                  key={w.weekId}
                  onClick={() => selectWeek(w)}
                  disabled={submitting}
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
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
  );
}
