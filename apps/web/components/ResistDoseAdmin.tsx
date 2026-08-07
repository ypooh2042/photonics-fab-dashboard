"use client";

import { useEffect, useState } from "react";

interface ResistDose {
  resistType: string;
  referenceDoseUcCm2: number;
  notes: string | null;
  referenceThicknessNm: number | null;
  isDefault: boolean;
}

export default function ResistDoseAdmin() {
  const [doses, setDoses] = useState<ResistDose[]>([]);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDose, setNewDose] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/resist-doses")
      .then((r) => r.json())
      .then(setDoses);
  }

  useEffect(load, []);

  async function updateDose(resistType: string, referenceDoseUcCm2: number) {
    setBusy(true);
    await fetch(`/api/admin/resist-doses/${encodeURIComponent(resistType)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referenceDoseUcCm2 }),
    });
    setBusy(false);
    load();
  }

  async function renameDose(resistType: string, newResistType: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/resist-doses/${encodeURIComponent(resistType)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resistType: newResistType }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "이름 수정 실패");
    }
    load();
  }

  async function setDefaultDose(resistType: string) {
    setBusy(true);
    await fetch(`/api/admin/resist-doses/${encodeURIComponent(resistType)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    setBusy(false);
    load();
  }

  async function deleteDose(resistType: string) {
    if (!confirm(`"${resistType}" 항목을 삭제할까요? 노광 신청 콤보박스에서 더 이상 보이지 않게 됩니다.`)) return;
    setBusy(true);
    await fetch(`/api/admin/resist-doses/${encodeURIComponent(resistType)}`, { method: "DELETE" });
    setBusy(false);
    load();
  }

  async function addDose() {
    if (!newName.trim() || typeof newDose !== "number") return;
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/resist-doses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resistType: newName, referenceDoseUcCm2: newDose }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "추가 실패");
      return;
    }
    setNewName("");
    setNewDose("");
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm opacity-70">
        노광 신청 페이지의 &quot;레지스트&quot; 콤보박스에 뜨는 이름과, 골랐을 때 기본값으로 표시되는 dose 값입니다. 라디오
        버튼으로 표시된 항목이 노광 신청 페이지에서 처음 열었을 때 기본 선택되는 레지스트입니다.
      </p>
      <div className="flex flex-col gap-2">
        {doses.map((d) => (
          <div
            key={d.resistType}
            className="flex items-center gap-2 rounded-md border border-black/10 dark:border-white/15 px-3 py-2 text-sm"
          >
            <input
              type="radio"
              name="defaultResist"
              checked={d.isDefault}
              disabled={busy || d.isDefault}
              onChange={() => setDefaultDose(d.resistType)}
              title="기본 레지스트로 설정"
            />
            <input
              defaultValue={d.resistType}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== d.resistType) renameDose(d.resistType, v);
              }}
              className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 font-medium"
            />
            <input
              type="number"
              defaultValue={d.referenceDoseUcCm2}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v !== d.referenceDoseUcCm2) updateDose(d.resistType, v);
              }}
              className="w-28 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
            />
            <span className="opacity-60">µC/cm²</span>
            <button onClick={() => deleteDose(d.resistType)} disabled={busy} className="text-red-500 text-xs disabled:opacity-50">
              삭제
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-black/20 dark:border-white/25 p-3 flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="이름 (예: ZEP520A)"
          className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
        />
        <input
          type="number"
          value={newDose}
          onChange={(e) => setNewDose(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="dose (µC/cm²)"
          className="w-32 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
        />
        <button
          onClick={addDose}
          disabled={busy || !newName.trim() || typeof newDose !== "number"}
          className="rounded-md bg-blue-600 text-white px-3 py-1 text-sm disabled:opacity-50"
        >
          추가
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
