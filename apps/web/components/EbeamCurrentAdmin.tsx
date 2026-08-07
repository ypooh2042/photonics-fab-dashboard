"use client";

import { useEffect, useState } from "react";

interface EbeamCurrent {
  currentNa: number;
  label: string;
  sortOrder: number;
  isDefault: boolean;
}

export default function EbeamCurrentAdmin() {
  const [currents, setCurrents] = useState<EbeamCurrent[]>([]);
  const [busy, setBusy] = useState(false);
  const [newCurrentNa, setNewCurrentNa] = useState<number | "">("");
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/ebeam-currents")
      .then((r) => r.json())
      .then(setCurrents);
  }

  useEffect(load, []);

  async function updateLabel(currentNa: number, label: string) {
    setBusy(true);
    await fetch(`/api/admin/ebeam-currents/${currentNa}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setBusy(false);
    load();
  }

  async function setDefaultCurrent(currentNa: number) {
    setBusy(true);
    await fetch(`/api/admin/ebeam-currents/${currentNa}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    setBusy(false);
    load();
  }

  async function deleteCurrent(currentNa: number, label: string) {
    if (!confirm(`"${label}" 항목을 삭제할까요? 노광 신청 콤보박스에서 더 이상 보이지 않게 됩니다.`)) return;
    setBusy(true);
    await fetch(`/api/admin/ebeam-currents/${currentNa}`, { method: "DELETE" });
    setBusy(false);
    load();
  }

  async function addCurrent() {
    if (typeof newCurrentNa !== "number" || !newLabel.trim()) return;
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/ebeam-currents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentNa: newCurrentNa, label: newLabel }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "추가 실패");
      return;
    }
    setNewCurrentNa("");
    setNewLabel("");
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm opacity-70">
        노광 신청 페이지의 &quot;E-beam Current&quot; 콤보박스에 뜨는 이름과, 골랐을 때 실제 계산에 쓰이는 current(nA) 값입니다.
        라디오 버튼으로 표시된 항목이 노광 신청 페이지에서 처음 열었을 때 기본 선택되는 current입니다.
      </p>
      <div className="flex flex-col gap-2">
        {currents.map((c) => (
          <div
            key={c.currentNa}
            className="flex items-center gap-2 rounded-md border border-black/10 dark:border-white/15 px-3 py-2 text-sm"
          >
            <input
              type="radio"
              name="defaultCurrent"
              checked={c.isDefault}
              disabled={busy || c.isDefault}
              onChange={() => setDefaultCurrent(c.currentNa)}
              title="기본 current로 설정"
            />
            <span className="w-20 opacity-60">{c.currentNa}nA</span>
            <input
              defaultValue={c.label}
              onBlur={(e) => {
                if (e.target.value !== c.label) updateLabel(c.currentNa, e.target.value);
              }}
              className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
            />
            <button
              onClick={() => deleteCurrent(c.currentNa, c.label)}
              disabled={busy}
              className="text-red-500 text-xs disabled:opacity-50"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-black/20 dark:border-white/25 p-3 flex items-center gap-2">
        <input
          type="number"
          value={newCurrentNa}
          onChange={(e) => setNewCurrentNa(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="current (nA)"
          className="w-32 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
        />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="이름 (예: 2nA (KANC 표준))"
          className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
        />
        <button
          onClick={addCurrent}
          disabled={busy || typeof newCurrentNa !== "number" || !newLabel.trim()}
          className="rounded-md bg-blue-600 text-white px-3 py-1 text-sm disabled:opacity-50"
        >
          추가
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
