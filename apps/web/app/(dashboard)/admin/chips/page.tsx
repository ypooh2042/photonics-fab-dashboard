"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ChipRun {
  id: number;
  label: string;
  projectName: string;
  status: string;
  lastUpdatedDate: string;
}

interface Project {
  id: number;
  slug: string;
  name: string;
}

export default function AdminChipsPage() {
  const [chipRuns, setChipRuns] = useState<ChipRun[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | "">("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/chip-runs")
      .then((r) => r.json())
      .then(setChipRuns);
    fetch("/api/admin/projects")
      .then((r) => r.json())
      .then((ps: Project[]) => {
        setProjects(ps);
        if (ps.length && projectId === "") setProjectId(ps[0].id);
      });
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeRuns = chipRuns.filter((cr) => cr.status !== "complete");
  const completeRuns = chipRuns.filter((cr) => cr.status === "complete");

  async function addChipRun() {
    if (!projectId || !label.trim()) return;
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/chip-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, label }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "추가 실패");
      return;
    }
    setLabel("");
    load();
  }

  async function removeChipRun(cr: ChipRun) {
    const warned = confirm(
      `"${cr.label}"을(를) 삭제하면 관련 스테이지/사진 데이터가 모두 없어지고 되돌릴 수 없습니다. 정말 삭제하시겠습니까?`,
    );
    if (!warned) return;
    setBusy(true);
    await fetch(`/api/admin/chip-runs/${cr.id}`, { method: "DELETE" });
    setBusy(false);
    load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">칩 런 관리</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        &quot;delivery&quot; 또는 &quot;completed_other&quot; 스테이지가 완료(complete) 상태가 되면 해당 칩 런은 자동으로 완료
        처리됩니다.
      </p>

      <div className="flex flex-col gap-2 mb-6">
        {activeRuns.map((cr) => (
          <div
            key={cr.id}
            className="flex items-center justify-between rounded-md border border-black/10 dark:border-white/15 px-3 py-2 text-sm"
          >
            <div>
              <Link href={`/admin/chips/${cr.id}/edit`} className="font-medium hover:underline">
                {cr.label}
              </Link>
              <span className="opacity-50 ml-2">{cr.projectName}</span>
              <span className="opacity-50 ml-2">{cr.status}</span>
              <span className="opacity-50 ml-2">{cr.lastUpdatedDate}</span>
            </div>
            <button onClick={() => removeChipRun(cr)} disabled={busy} className="text-red-500 text-xs">
              삭제
            </button>
          </div>
        ))}
      </div>

      {completeRuns.length > 0 && (
        <details className="mb-6 rounded-md border border-black/10 dark:border-white/15">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
            완료된 칩 런 목록 ({completeRuns.length})
          </summary>
          <div className="flex flex-col gap-2 p-3 pt-0">
            {completeRuns.map((cr) => (
              <div
                key={cr.id}
                className="flex items-center justify-between rounded-md border border-black/10 dark:border-white/15 px-3 py-2 text-sm"
              >
                <div>
                  <Link href={`/admin/chips/${cr.id}/edit`} className="font-medium hover:underline">
                    {cr.label}
                  </Link>
                  <span className="opacity-50 ml-2">{cr.projectName}</span>
                  <span className="opacity-50 ml-2">{cr.status}</span>
                  <span className="opacity-50 ml-2">{cr.lastUpdatedDate}</span>
                </div>
                <button onClick={() => removeChipRun(cr)} disabled={busy} className="text-red-500 text-xs">
                  삭제
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="rounded-lg border border-dashed border-black/20 dark:border-white/25 p-4 flex flex-col gap-2">
        <p className="text-sm font-medium">새 칩 런 추가</p>
        <select
          value={projectId}
          onChange={(e) => setProjectId(Number(e.target.value))}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Run 이름 (예: 0801_EMC_run)"
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          onClick={addChipRun}
          disabled={busy || !label.trim()}
          className="rounded-md bg-blue-600 text-white py-2 text-sm disabled:opacity-50"
        >
          추가
        </button>
      </div>
    </div>
  );
}
