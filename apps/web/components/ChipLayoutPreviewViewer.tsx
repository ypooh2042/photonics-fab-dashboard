"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LayoutGridPreview from "./LayoutGridPreview";

type CassetteType = "piece1" | "piece2";
type WindowKey = "A" | "B" | "D";

const CASSETTE_WINDOW_KEYS: Record<CassetteType, WindowKey[]> = {
  piece1: ["A", "B"],
  piece2: ["A", "B", "D"],
};

function defaultWindowKey(cassetteType: CassetteType): WindowKey {
  return cassetteType === "piece2" ? "B" : CASSETTE_WINDOW_KEYS[cassetteType][0];
}

interface PatternCandidate {
  patternKey: string;
  slotLetter: string;
  candidateLabel: string;
  sizeXUm: number;
  sizeYUm: number;
}

interface ExposureJob {
  id: number;
  name: string;
  currentNa: number;
  doseUcCm2: number;
  scanStep: number;
  windowKey: WindowKey;
}

interface PlacementInstance {
  id: number;
  slotLetter: string;
  candidateLabel: string;
  centerXUm: number;
  centerYUm: number;
}

interface Props {
  equipmentUserId: number;
  jobId: number;
  jobName: string;
  cassetteType: CassetteType;
}

function fmtUm(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function ChipLayoutPreviewViewer({ equipmentUserId, jobId, jobName, cassetteType }: Props) {
  const [windowKey, setWindowKey] = useState<WindowKey>(defaultWindowKey(cassetteType));
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<PatternCandidate[]>([]);
  const [exposureJobs, setExposureJobs] = useState<ExposureJob[]>([]);
  const [placementsByJob, setPlacementsByJob] = useState<Record<number, PlacementInstance[]>>({});

  useEffect(() => {
    setSvg(null);
    setError(null);
    fetch(`/api/chip-layout/jobs/${jobId}/preview/${windowKey}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setError(d.error ?? "불러오기 실패");
          return;
        }
        setSvg(d.svg);
      })
      .catch(() => setError("불러오기 실패"));
  }, [jobId, windowKey]);

  useEffect(() => {
    fetch(`/api/chip-layout/jobs/${jobId}/patterns`)
      .then((r) => r.json())
      .then(setCandidates);
    fetch(`/api/chip-layout/jobs/${jobId}/exposure-jobs`)
      .then((r) => r.json())
      .then(async (jobs: ExposureJob[]) => {
        setExposureJobs(jobs);
        const entries = await Promise.all(
          jobs.map(async (ej) => {
            const placements: PlacementInstance[] = await fetch(`/api/chip-layout/exposure-jobs/${ej.id}/placements`).then((r) =>
              r.json(),
            );
            return [ej.id, placements] as const;
          }),
        );
        setPlacementsByJob(Object.fromEntries(entries));
      });
  }, [jobId]);

  const windowOptions = CASSETTE_WINDOW_KEYS[cassetteType];
  const sortedCandidates = [...candidates].sort((a, b) => a.slotLetter.localeCompare(b.slotLetter));

  return (
    <div className="max-w-3xl">
      <Link href={`/chip-layout/${equipmentUserId}`} className="text-sm opacity-60 hover:opacity-100">
        ← 뒤로가기
      </Link>
      <div className="flex items-center justify-between mt-2 mb-4">
        <h1 className="text-xl font-semibold">{jobName} · 전체 패턴 뷰</h1>
        <label className="flex items-center gap-1 text-sm">
          Window
          <select
            value={windowKey}
            onChange={(e) => setWindowKey(e.target.value as WindowKey)}
            className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
          >
            {windowOptions.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {svg && <LayoutGridPreview svg={svg} visibleLayerKeys={new Set()} gridBounds={null} showFieldGrid={false} />}

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">파라미터 요약</h2>

        <p className="text-sm opacity-80 mb-4">
          cassette <span className="font-medium">{cassetteType}</span>
        </p>

        <div className="rounded-lg border border-black/10 dark:border-white/15 p-3 mb-4">
          <p className="text-sm font-semibold mb-2">슬롯 사전</p>
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="text-left opacity-60 text-xs">
                <th className="pb-1 w-10">슬롯</th>
                <th className="pb-1">패턴 이름</th>
                <th className="pb-1 w-28 text-right">크기 (µm)</th>
              </tr>
            </thead>
            <tbody>
              {sortedCandidates.map((c) => (
                <tr key={c.patternKey} className="border-t border-black/5 dark:border-white/10">
                  <td className="py-1 font-semibold">{c.slotLetter}</td>
                  <td className="py-1 break-words">{c.candidateLabel}</td>
                  <td className="py-1 text-right whitespace-nowrap">
                    {fmtUm(c.sizeXUm)} × {fmtUm(c.sizeYUm)}
                  </td>
                </tr>
              ))}
              {sortedCandidates.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-xs opacity-50">
                    배치된 패턴이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3">
          {exposureJobs.map((ej) => {
            const placements = [...(placementsByJob[ej.id] ?? [])].sort((a, b) => a.slotLetter.localeCompare(b.slotLetter));
            return (
              <div key={ej.id} className="rounded-lg border border-black/10 dark:border-white/15 p-3">
                <p className="text-sm font-semibold mb-1">{ej.name}</p>
                <p className="text-sm opacity-80 mb-2">
                  window <span className="font-medium">{ej.windowKey}</span> · current{" "}
                  <span className="font-medium">{ej.currentNa}nA</span> · dose{" "}
                  <span className="font-medium">{ej.doseUcCm2}µC/cm²</span> · scan step{" "}
                  <span className="font-medium">{ej.scanStep}</span>
                </p>
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="text-left opacity-60 text-xs">
                      <th className="pb-1 w-10">슬롯</th>
                      <th className="pb-1">패턴 이름</th>
                      <th className="pb-1 w-24 text-right">center_x (µm)</th>
                      <th className="pb-1 w-24 text-right">center_y (µm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placements.map((p) => (
                      <tr key={p.id} className="border-t border-black/5 dark:border-white/10">
                        <td className="py-1 font-semibold">{p.slotLetter}</td>
                        <td className="py-1 break-words">{p.candidateLabel}</td>
                        <td className="py-1 text-right whitespace-nowrap">{fmtUm(p.centerXUm)}</td>
                        <td className="py-1 text-right whitespace-nowrap">{fmtUm(p.centerYUm)}</td>
                      </tr>
                    ))}
                    {placements.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-2 text-xs opacity-50">
                          배치된 패턴이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
          {exposureJobs.length === 0 && <p className="text-sm opacity-50">Job이 없습니다.</p>}
        </div>
      </div>
    </div>
  );
}
