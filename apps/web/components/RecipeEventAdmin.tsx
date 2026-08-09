"use client";

import { useEffect, useState } from "react";

interface RecipeEvent {
  id: number;
  eventDate: string;
  label: string;
}

export default function RecipeEventAdmin({ categorySlug, recipeName }: { categorySlug: string; recipeName: string }) {
  const [events, setEvents] = useState<RecipeEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/admin/recipe-events?category=${encodeURIComponent(categorySlug)}&recipeName=${encodeURIComponent(recipeName)}`)
      .then((r) => r.json())
      .then(setEvents);
  }

  useEffect(load, [categorySlug, recipeName]);

  async function updateEvent(id: number, eventDate: string, label: string) {
    setBusy(true);
    await fetch(`/api/admin/recipe-events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventDate, label }),
    });
    setBusy(false);
    load();
  }

  async function deleteEvent(id: number) {
    if (!confirm("이 이벤트 마커를 삭제할까요?")) return;
    setBusy(true);
    await fetch(`/api/admin/recipe-events/${id}`, { method: "DELETE" });
    setBusy(false);
    load();
  }

  async function addEvent() {
    if (!newDate || !newLabel.trim()) return;
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/recipe-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorySlug, recipeName, eventDate: newDate, label: newLabel }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "추가 실패");
      return;
    }
    setNewDate("");
    setNewLabel("");
    load();
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm opacity-60">
        이 레시피의 트렌드 그래프에 표시할 이벤트 마커 (예: 장비 셧다운) — 반투명 빨간 세로선으로 표시됩니다.
      </span>
      <div className="flex flex-col gap-2">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="flex items-center gap-2 rounded-md border border-black/10 dark:border-white/15 px-3 py-2 text-sm"
          >
            <input
              type="date"
              defaultValue={ev.eventDate}
              onBlur={(e) => {
                if (e.target.value && e.target.value !== ev.eventDate) updateEvent(ev.id, e.target.value, ev.label);
              }}
              className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
            />
            <input
              defaultValue={ev.label}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== ev.label) updateEvent(ev.id, ev.eventDate, v);
              }}
              className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
            />
            <button onClick={() => deleteEvent(ev.id)} disabled={busy} className="text-red-500 text-xs disabled:opacity-50">
              삭제
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-black/20 dark:border-white/25 p-3 flex items-center gap-2">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
        />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="이벤트 설명 (예: 팹 공사로 장비 셧다운)"
          className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
        />
        <button
          onClick={addEvent}
          disabled={busy || !newDate || !newLabel.trim()}
          className="rounded-md bg-blue-600 text-white px-3 py-1 text-sm disabled:opacity-50"
        >
          추가
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
