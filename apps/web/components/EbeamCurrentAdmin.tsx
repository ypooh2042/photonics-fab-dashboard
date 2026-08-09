"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageContext";

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
  const { t } = useLanguage();

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
    if (!confirm(`"${label}" ${t("confirmDeletePreset")}`)) return;
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
      setError(d.error ?? t("addFailed"));
      return;
    }
    setNewCurrentNa("");
    setNewLabel("");
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm opacity-70">{t("ebeamCurrentHint")}</p>
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
              title={t("setAsDefaultCurrentTitle")}
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
              {t("delete")}
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
          placeholder={t("ebeamNamePlaceholder")}
          className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
        />
        <button
          onClick={addCurrent}
          disabled={busy || typeof newCurrentNa !== "number" || !newLabel.trim()}
          className="rounded-md bg-blue-600 text-white px-3 py-1 text-sm disabled:opacity-50"
        >
          {t("add")}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
