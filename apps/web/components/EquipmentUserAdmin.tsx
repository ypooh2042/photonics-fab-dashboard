"use client";

import { useEffect, useState } from "react";

interface EquipmentUser {
  id: number;
  name: string;
  alias: string;
  isPermanent: boolean;
  capacityHours: number;
  loadingCostMinutes: number;
  displayOrder: number;
}

export default function EquipmentUserAdmin() {
  const [users, setUsers] = useState<EquipmentUser[]>([]);
  const [totalCapacityHours, setTotalCapacityHours] = useState<number | null>(null);
  const [capacityInputs, setCapacityInputs] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [savingCapacities, setSavingCapacities] = useState(false);
  const [capacityMessage, setCapacityMessage] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newAlias, setNewAlias] = useState("");
  const [newIsPermanent, setNewIsPermanent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/equipment-users")
      .then((r) => r.json())
      .then((list: EquipmentUser[]) => {
        setUsers(list);
        setCapacityInputs(Object.fromEntries(list.map((u) => [u.id, String(u.capacityHours)])));
      });
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((s) => setTotalCapacityHours(s.weeklyCapacityHours));
  }

  useEffect(load, []);

  async function updateUser(
    id: number,
    body: Partial<{ name: string; alias: string; isPermanent: boolean; loadingCostMinutes: number }>,
  ) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/equipment-users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "수정 실패");
      return;
    }
    load();
  }

  async function deleteUser(id: number, name: string) {
    if (!confirm(`"${name}" 장비 사용자를 삭제할까요?`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/equipment-users/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "삭제 실패");
      return;
    }
    load();
  }

  async function addUser() {
    if (!newName.trim() || !newAlias.trim()) return;
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/equipment-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, alias: newAlias, isPermanent: newIsPermanent }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "추가 실패");
      return;
    }
    setNewName("");
    setNewAlias("");
    setNewIsPermanent(false);
    load();
  }

  async function saveCapacities() {
    setCapacityMessage(null);
    setSavingCapacities(true);
    const capacities = users.map((u) => ({ id: u.id, capacityHours: Number(capacityInputs[u.id] ?? u.capacityHours) }));
    const res = await fetch("/api/admin/equipment-users/capacities", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capacities }),
    });
    setSavingCapacities(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCapacityMessage(d.error ?? "저장 실패");
      return;
    }
    setCapacityMessage("저장됨");
    setUsers(d);
    setCapacityInputs(Object.fromEntries((d as EquipmentUser[]).map((u) => [u.id, String(u.capacityHours)])));
  }

  const capacitySum = users.reduce((s, u) => s + (Number(capacityInputs[u.id]) || 0), 0);
  const capacityBalanced = totalCapacityHours != null && Math.abs(capacitySum - totalCapacityHours) < 1e-6;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm opacity-70">
        노광 신청 콤보박스에 뜨는 장비 사용자 목록입니다. 별명은 GDS 파일명 정리에 쓰이므로 영문/숫자/밑줄만
        가능합니다. 상시 사용자는 항상 노광 큐에 표시되며, 그 외 사용자는 노광 신청에서 선택되었을 때만 큐에
        나타납니다. 위쪽 &quot;주당 장비 가용 시간&quot;(총 가용 시간)을 바꾸면 상시 사용자들에게 자동으로 균등 재분배되고,
        그 외에는 아래에서 직접 입력한 값이 그대로 유지됩니다 — 다만 전원의 가용시간 합은 항상 총 가용 시간과
        같아야 저장됩니다. 로딩 시간(current 전환당)은 사용자별로 독립적으로 관리되며, 가용시간과 달리 합계 제약
        없이 바로 저장됩니다.
      </p>
      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-2 rounded-md border border-black/10 dark:border-white/15 px-3 py-2 text-sm"
          >
            <input
              defaultValue={u.name}
              onBlur={(e) => {
                if (e.target.value !== u.name) updateUser(u.id, { name: e.target.value });
              }}
              className="w-24 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
            />
            <input
              defaultValue={u.alias}
              onBlur={(e) => {
                if (e.target.value !== u.alias) updateUser(u.id, { alias: e.target.value });
              }}
              className="w-24 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
            />
            <label className="flex items-center gap-1 text-xs opacity-80 shrink-0">
              <input
                type="checkbox"
                checked={u.isPermanent}
                onChange={(e) => updateUser(u.id, { isPermanent: e.target.checked })}
              />
              상시
            </label>
            <span className="flex items-center gap-1 w-28 text-xs">
              <input
                type="number"
                step="0.1"
                min={0}
                value={capacityInputs[u.id] ?? ""}
                onChange={(e) => setCapacityInputs((prev) => ({ ...prev, [u.id]: e.target.value }))}
                className="w-16 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
              />
              시간
            </span>
            <span className="flex items-center gap-1 w-24 text-xs">
              <input
                type="number"
                step="1"
                min={0}
                defaultValue={u.loadingCostMinutes}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (value !== u.loadingCostMinutes) updateUser(u.id, { loadingCostMinutes: value });
                }}
                className="w-14 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
              />
              분(로딩)
            </span>
            <button
              onClick={() => deleteUser(u.id, u.name)}
              disabled={busy}
              className="text-red-500 text-xs disabled:opacity-50 shrink-0 ml-auto"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={saveCapacities}
          disabled={savingCapacities}
          className="rounded-md bg-blue-600 text-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {savingCapacities ? "저장 중..." : "가용시간 저장"}
        </button>
        {totalCapacityHours != null && (
          <span className={`text-xs ${capacityBalanced ? "opacity-60" : "text-red-500"}`}>
            현재 합계 {capacitySum.toFixed(2)}시간 / 총 가용 시간 {totalCapacityHours}시간
            {!capacityBalanced && " — 합이 맞지 않으면 저장이 거부됩니다"}
          </span>
        )}
      </div>
      {capacityMessage && (
        <p className={`text-sm ${capacityMessage === "저장됨" ? "opacity-70" : "text-red-500"}`}>{capacityMessage}</p>
      )}

      <div className="rounded-lg border border-dashed border-black/20 dark:border-white/25 p-3 flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="이름 (예: 홍길동)"
          className="w-28 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
        />
        <input
          value={newAlias}
          onChange={(e) => setNewAlias(e.target.value)}
          placeholder="별명 (예: gildong)"
          className="w-28 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
        />
        <label className="flex items-center gap-1 text-xs opacity-80 shrink-0">
          <input type="checkbox" checked={newIsPermanent} onChange={(e) => setNewIsPermanent(e.target.checked)} />
          상시
        </label>
        <button
          onClick={addUser}
          disabled={busy || !newName.trim() || !newAlias.trim()}
          className="rounded-md bg-blue-600 text-white px-3 py-1 text-sm disabled:opacity-50 ml-auto"
        >
          추가
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
