"use client";

import { useEffect, useState } from "react";
import ResistDoseAdmin from "@/components/ResistDoseAdmin";
import EbeamCurrentAdmin from "@/components/EbeamCurrentAdmin";
import EquipmentUserAdmin from "@/components/EquipmentUserAdmin";
import { describeWeek } from "@fab-dashboard/scheduling/week-boundary";

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

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cutoverResult, setCutoverResult] = useState<string | null>(null);

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
    setMessage(res.ok ? "저장됨" : "저장 실패");
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
      const proceed = confirm(`${m}월 ${d}일 오후 6시 이후가 아닙니다. 노광 큐를 다음 주차로 변경하시겠습니까?`);
      if (!proceed) return;
    }

    setCutoverResult(null);
    const res = await fetch("/api/admin/cutover", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setCutoverResult(data.error ?? "실패");
      return;
    }
    setCutoverResult(`${data.fromWeekId} → ${data.toWeekId}로 ${data.movedCount}건 이월됨`);
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then(setSettings);
  }

  if (!settings) return <p className="opacity-60">불러오는 중...</p>;

  return (
    <div className="max-w-xl flex flex-col gap-4">
      <h1 className="text-xl font-semibold">노광 설정</h1>

      <label className="flex flex-col gap-1 text-sm">
        <span>주당 장비 가용 시간 (시간)</span>
        <input
          type="number"
          step="0.5"
          value={settings.weeklyCapacityHours}
          onChange={(e) => setSettings({ ...settings, weeklyCapacityHours: Number(e.target.value) })}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Exposure calibration 시간 (분, 레이아웃당)</span>
        <input
          type="number"
          step="0.5"
          value={settings.calibrationCostMinutes}
          onChange={(e) => setSettings({ ...settings, calibrationCostMinutes: Number(e.target.value) })}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>노광 레이어당 추가 시간 (초)</span>
        <input
          type="number"
          value={settings.perLayerCostSeconds}
          onChange={(e) => setSettings({ ...settings, perLayerCostSeconds: Number(e.target.value) })}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>최소 dwell time (ns) — 장비 스펙상 픽셀당 머무는 시간의 하한, 노광 해상도 계산에 사용됨</span>
        <input
          type="number"
          step="0.1"
          value={settings.minDwellNs}
          onChange={(e) => setSettings({ ...settings, minDwellNs: Number(e.target.value) })}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>PEC 마진 (%) — dwell time 하한에 더하는 여유분, 노광 해상도 계산에 사용됨</span>
        <input
          type="number"
          step="1"
          value={settings.dwellMarginRatio * 100}
          onChange={(e) => setSettings({ ...settings, dwellMarginRatio: Number(e.target.value) / 100 })}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>이월 요일</span>
        <select
          value={settings.cutoverDayOfWeek}
          onChange={(e) => setSettings({ ...settings, cutoverDayOfWeek: Number(e.target.value) })}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        >
          {DAYS.map((d, i) => (
            <option key={i} value={i}>
              {d}요일
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2">
        <label className="flex flex-col gap-1 text-sm flex-1">
          <span>시</span>
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
          <span>분</span>
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
        {saving ? "저장 중..." : "저장"}
      </button>
      {message && <p className="text-sm opacity-70">{message}</p>}

      <hr className="border-black/10 dark:border-white/15 my-2" />

      <div>
        <p className="text-sm mb-2">
          자동 이월은 매주 {DAYS[settings.cutoverDayOfWeek]}요일 {settings.cutoverHour}:
          {String(settings.cutoverMinute).padStart(2, "0")}에 일어납니다. 아직 노광되지 않은 항목 중, 이번 주
          용량 안에 다 못 들어갈 것으로 예상되는 노란색·주황색 큐만 다음 주로 이월됩니다 — 초록색(이번 주 안에
          노광 가능)은 이월되지 않습니다. 수동으로 이미 옮겨둔 항목도 대상에서 제외됩니다. 이월은 특정 장비
          사용자만이 아니라 전체 장비 사용자의 큐가 한 번에 같이 이월됩니다. 지금 수동으로 이월시키려면:
        </p>
        <button
          onClick={onManualCutover}
          className="rounded-md border border-amber-500 text-amber-500 py-2 px-4 text-sm hover:bg-amber-500/10"
        >
          지금 이월 실행
        </button>
        {cutoverResult && <p className="text-sm opacity-70 mt-2">{cutoverResult}</p>}
      </div>

      <hr className="border-black/10 dark:border-white/15 my-2" />

      <div>
        <h2 className="text-lg font-semibold mb-2">장비 사용자</h2>
        <EquipmentUserAdmin />
      </div>

      <hr className="border-black/10 dark:border-white/15 my-2" />

      <div>
        <h2 className="text-lg font-semibold mb-2">Dose 프리셋</h2>
        <ResistDoseAdmin />
      </div>

      <hr className="border-black/10 dark:border-white/15 my-2" />

      <div>
        <h2 className="text-lg font-semibold mb-2">E-beam Current 프리셋</h2>
        <EbeamCurrentAdmin />
      </div>
    </div>
  );
}
