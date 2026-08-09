"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageContext";

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
  const [capacitySaveOk, setCapacitySaveOk] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAlias, setNewAlias] = useState("");
  const [newIsPermanent, setNewIsPermanent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

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
      setError(d.error ?? t("updateFailed"));
      return;
    }
    load();
  }

  async function deleteUser(id: number, name: string) {
    if (!confirm(`"${name}" ${t("confirmDeleteEquipmentUser")}`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/equipment-users/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? t("deleteFailed"));
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
      setError(d.error ?? t("addFailed"));
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
      setCapacitySaveOk(false);
      setCapacityMessage(d.error ?? t("saveFailed"));
      return;
    }
    setCapacitySaveOk(true);
    setCapacityMessage(t("saved"));
    setUsers(d);
    setCapacityInputs(Object.fromEntries((d as EquipmentUser[]).map((u) => [u.id, String(u.capacityHours)])));
  }

  const capacitySum = users.reduce((s, u) => s + (Number(capacityInputs[u.id]) || 0), 0);
  const capacityBalanced = totalCapacityHours != null && Math.abs(capacitySum - totalCapacityHours) < 1e-6;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm opacity-70">{t("equipmentUserHint")}</p>
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
              {t("permanentLabel")}
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
              {t("capacityHoursFieldLabel")}
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
              {t("loadingMinutesFieldLabel")}
            </span>
            <button
              onClick={() => deleteUser(u.id, u.name)}
              disabled={busy}
              className="text-red-500 text-xs disabled:opacity-50 shrink-0 ml-auto"
            >
              {t("delete")}
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
          {savingCapacities ? t("saving") : t("saveCapacitiesLabel")}
        </button>
        {totalCapacityHours != null && (
          <span className={`text-xs ${capacityBalanced ? "opacity-60" : "text-red-500"}`}>
            {t("currentSumLabel")} {capacitySum.toFixed(2)} / {t("totalCapacityInline")} {totalCapacityHours}
            {t("capacityHoursFieldLabel")}
            {!capacityBalanced && ` — ${t("sumMismatchWarning")}`}
          </span>
        )}
      </div>
      {capacityMessage && (
        <p className={`text-sm ${capacitySaveOk ? "opacity-70" : "text-red-500"}`}>{capacityMessage}</p>
      )}

      <div className="rounded-lg border border-dashed border-black/20 dark:border-white/25 p-3 flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("equipmentUserNamePlaceholder")}
          className="w-28 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
        />
        <input
          value={newAlias}
          onChange={(e) => setNewAlias(e.target.value)}
          placeholder={t("aliasPlaceholder")}
          className="w-28 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
        />
        <label className="flex items-center gap-1 text-xs opacity-80 shrink-0">
          <input type="checkbox" checked={newIsPermanent} onChange={(e) => setNewIsPermanent(e.target.checked)} />
          {t("permanentLabel")}
        </label>
        <button
          onClick={addUser}
          disabled={busy || !newName.trim() || !newAlias.trim()}
          className="rounded-md bg-blue-600 text-white px-3 py-1 text-sm disabled:opacity-50 ml-auto"
        >
          {t("add")}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
