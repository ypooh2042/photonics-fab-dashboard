"use client";

import { useEffect, useState } from "react";
import ResistDoseAdmin from "@/components/ResistDoseAdmin";
import EbeamCurrentAdmin from "@/components/EbeamCurrentAdmin";
import EquipmentUserAdmin from "@/components/EquipmentUserAdmin";
import { describeWeek } from "@fab-dashboard/scheduling/week-boundary";
import { useLanguage } from "@/components/LanguageContext";
import type { DictKey } from "@/lib/i18n";

interface Settings {
  weeklyCapacityHours: number;
  cutoverDayOfWeek: number;
  cutoverHour: number;
  cutoverMinute: number;
  timezone: string;
  loadingCostMinutes: number;
  calibrationCostMinutes: number;
  perLayerCostSeconds: number;
  minDwellNs: number;
  dwellMarginRatio: number;
  currentWeekId: string;
}

const DAY_KEYS: DictKey[] = ["daySun", "dayMon", "dayTue", "dayWed", "dayThu", "dayFri", "daySat"];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cutoverResult, setCutoverResult] = useState<string | null>(null);
  const { lang, t } = useLanguage();
  const DAYS = DAY_KEYS.map((k) => t(k));

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  async function onSave() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setMessage(res.ok ? t("saved") : t("saveFailed"));
  }

  async function onManualCutover() {
    if (!settings) return;

    // Exposure day is every Tuesday, the day before the (Wednesday) cutover —
    // closing the queue before that week's own Tuesday exposure has actually
    // happened would prematurely roll over a week that hasn't finished yet,
    // so guard with a confirmation instead of blocking outright (in case the
    // admin genuinely means to do this early).
    const { endDate } = describeWeek(settings.currentWeekId);
    const [y, m, d] = endDate.split("-").map(Number);
    const exposureCutoff = new Date(y, m - 1, d, 18, 0, 0);
    if (new Date() < exposureCutoff) {
      const proceed = confirm(
        lang === "ko"
          ? `${m}월 ${d}일 오후 6시 이후가 아닙니다. 노광 큐를 다음 주차로 변경하시겠습니까?`
          : `It's not yet past 6PM on ${m}/${d}. Roll the exposure queue over to next week anyway?`,
      );
      if (!proceed) return;
    }

    setCutoverResult(null);
    const res = await fetch("/api/admin/cutover", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setCutoverResult(data.error ?? t("cutoverFailedLabel"));
      return;
    }
    setCutoverResult(
      lang === "ko"
        ? `${data.fromWeekId} → ${data.toWeekId} 주차 전환 완료 (미완료 노광은 그대로 큐에 남습니다)`
        : `Rolled over ${data.fromWeekId} → ${data.toWeekId} (unfinished exposures stay in the queue)`,
    );
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then(setSettings);
  }

  if (!settings) return <p className="opacity-60">{t("loadingEllipsis")}</p>;

  return (
    <div className="max-w-xl flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("adminSettings")}</h1>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("weeklyCapacityLabel")}</span>
        <input
          type="number"
          step="0.5"
          value={settings.weeklyCapacityHours}
          onChange={(e) => setSettings({ ...settings, weeklyCapacityHours: Number(e.target.value) })}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("calibrationTimeLabel")}</span>
        <input
          type="number"
          step="0.5"
          value={settings.calibrationCostMinutes}
          onChange={(e) => setSettings({ ...settings, calibrationCostMinutes: Number(e.target.value) })}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("perLayerTimeLabel")}</span>
        <input
          type="number"
          value={settings.perLayerCostSeconds}
          onChange={(e) => setSettings({ ...settings, perLayerCostSeconds: Number(e.target.value) })}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("minDwellLabel")}</span>
        <input
          type="number"
          step="0.1"
          value={settings.minDwellNs}
          onChange={(e) => setSettings({ ...settings, minDwellNs: Number(e.target.value) })}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("pecMarginLabel")}</span>
        <input
          type="number"
          step="1"
          value={settings.dwellMarginRatio * 100}
          onChange={(e) => setSettings({ ...settings, dwellMarginRatio: Number(e.target.value) / 100 })}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("cutoverDayLabel")}</span>
        <select
          value={settings.cutoverDayOfWeek}
          onChange={(e) => setSettings({ ...settings, cutoverDayOfWeek: Number(e.target.value) })}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        >
          {DAYS.map((d, i) => (
            <option key={i} value={i}>
              {d}
              {t("weekdaySuffix")}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2">
        <label className="flex flex-col gap-1 text-sm flex-1">
          <span>{t("hourLabel")}</span>
          <input
            type="number"
            min={0}
            max={23}
            value={settings.cutoverHour}
            onChange={(e) => setSettings({ ...settings, cutoverHour: Number(e.target.value) })}
            className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1">
          <span>{t("minuteFieldLabel")}</span>
          <input
            type="number"
            min={0}
            max={59}
            value={settings.cutoverMinute}
            onChange={(e) => setSettings({ ...settings, cutoverMinute: Number(e.target.value) })}
            className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
          />
        </label>
      </div>

      <button onClick={onSave} disabled={saving} className="rounded-md bg-blue-600 text-white py-2 disabled:opacity-50">
        {saving ? t("saving") : t("save")}
      </button>
      {message && <p className="text-sm opacity-70">{message}</p>}

      <hr className="border-black/10 dark:border-white/15 my-2" />

      <div>
        <p className="text-sm mb-2">
          {lang === "ko" ? (
            <>
              자동 이월은 매주 {DAYS[settings.cutoverDayOfWeek]}요일 {settings.cutoverHour}:
              {String(settings.cutoverMinute).padStart(2, "0")}에 일어납니다. 아직 노광되지 않은 항목 중, 이번 주
              용량 안에 다 못 들어갈 것으로 예상되는 노란색·주황색 큐만 다음 주로 이월됩니다 — 초록색(이번 주 안에
              노광 가능)은 이월되지 않습니다. 수동으로 이미 옮겨둔 항목도 대상에서 제외됩니다. 이월은 특정 장비
              사용자만이 아니라 전체 장비 사용자의 큐가 한 번에 같이 이월됩니다. 지금 수동으로 이월시키려면:
            </>
          ) : (
            <>
              Automatic rollover happens every {DAYS[settings.cutoverDayOfWeek]} at {settings.cutoverHour}:
              {String(settings.cutoverMinute).padStart(2, "0")}. Among not-yet-exposed items, only yellow/orange
              queue entries expected not to fit this week&apos;s capacity roll over to next week — green entries
              (fit within this week) do not roll over, and items already moved manually are excluded. Rollover
              applies to all equipment users&apos; queues at once, not just one. To roll over manually right now:
            </>
          )}
        </p>
        <button
          onClick={onManualCutover}
          className="rounded-md border border-amber-500 text-amber-500 py-2 px-4 text-sm hover:bg-amber-500/10"
        >
          {t("runCutoverNowLabel")}
        </button>
        {cutoverResult && <p className="text-sm opacity-70 mt-2">{cutoverResult}</p>}
      </div>

      <hr className="border-black/10 dark:border-white/15 my-2" />

      <div>
        <h2 className="text-lg font-semibold mb-2">{t("equipmentUsersHeading")}</h2>
        <EquipmentUserAdmin />
      </div>

      <hr className="border-black/10 dark:border-white/15 my-2" />

      <div>
        <h2 className="text-lg font-semibold mb-2">{t("dosePresetHeading")}</h2>
        <ResistDoseAdmin />
      </div>

      <hr className="border-black/10 dark:border-white/15 my-2" />

      <div>
        <h2 className="text-lg font-semibold mb-2">{t("ebeamCurrentPresetHeading")}</h2>
        <EbeamCurrentAdmin />
      </div>
    </div>
  );
}
