"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import WindowCanvas from "./WindowCanvas";
import ChipLayoutPreviewModal from "./ChipLayoutPreviewModal";
import { chipFillColor } from "@/lib/chip-colors";
import { useLanguage } from "@/components/LanguageContext";
import type { Lang } from "@/lib/i18n";

type CassetteType = "piece1" | "piece2";
type WindowKey = "A" | "B" | "D";

const MM = 1000;

const CASSETTE_WINDOWS: Record<CassetteType, { key: WindowKey; widthUm: number; heightUm: number }[]> = {
  piece1: [
    { key: "A", widthUm: 50 * MM, heightUm: 8 * MM },
    { key: "B", widthUm: 50 * MM, heightUm: 18 * MM },
  ],
  piece2: [
    { key: "A", widthUm: 50 * MM, heightUm: 28 * MM },
    { key: "B", widthUm: 50 * MM, heightUm: 18 * MM },
    { key: "D", widthUm: 50 * MM, heightUm: 18 * MM },
  ],
};

/** piece2's default view is window B; piece1 has no specific default, so just show its first window. */
function defaultWindowKey(cassetteType: CassetteType): WindowKey {
  if (cassetteType === "piece2") return "B";
  return CASSETTE_WINDOWS[cassetteType][0].key;
}

function formatHm(totalSeconds: number, lang: Lang): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return lang === "ko" ? `${h}시간 ${m}분` : `${h}h ${m}min`;
}

interface Job {
  id: number;
  equipmentUserId: number;
  name: string;
  cassetteType: CassetteType;
  displayOrder: number;
}

interface WeekSummary {
  weekId: string;
  label: string;
  isOpen: boolean;
}

interface Chip {
  id: number;
  jobId: number;
  name: string;
  windowKey: WindowKey;
  widthUm: number;
  centerXUm: number;
}

interface PatternCandidate {
  patternKey: string;
  slotIndex: number;
  slotLetter: string;
  candidateLabel: string;
  sizeXUm: number;
  sizeYUm: number;
}

interface ExposureJob {
  id: number;
  batchId: number;
  name: string;
  currentNa: number;
  doseUcCm2: number;
  scanStep: number;
  windowKey: WindowKey;
}

interface PlacementInstance {
  id: number;
  exposureJobId: number;
  patternKey: string;
  slotLetter: string;
  candidateLabel: string;
  sizeXUm: number;
  sizeYUm: number;
  windowKey: WindowKey;
  centerXUm: number;
  centerYUm: number;
}

interface ExposureSummary {
  calculatedSeconds: number;
  minSeconds: number;
  maxSeconds: number;
}

interface Props {
  equipmentUserId: number;
  equipmentUserName: string;
  equipmentUserAlias: string;
  defaultLoadingCostMinutes: number;
}

export default function ChipLayoutEditor({
  equipmentUserId,
  equipmentUserName,
  equipmentUserAlias,
  defaultLoadingCostMinutes,
}: Props) {
  const router = useRouter();
  const { lang, t } = useLanguage();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [chips, setChips] = useState<Chip[]>([]);
  const [patternCandidates, setPatternCandidates] = useState<PatternCandidate[]>([]);
  const [exposureJobs, setExposureJobs] = useState<ExposureJob[]>([]);
  const [selectedExposureJobId, setSelectedExposureJobId] = useState<number | null>(null);
  const [placementInstances, setPlacementInstances] = useState<PlacementInstance[]>([]);
  const [exposureSummary, setExposureSummary] = useState<ExposureSummary | null>(null);
  const [selectedWindowKey, setSelectedWindowKey] = useState<WindowKey>("B");
  const [editMode, setEditMode] = useState(false);
  const [viewWeekId, setViewWeekId] = useState<string | null>(null);
  const [viewingOpen, setViewingOpen] = useState(true);
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [weeks, setWeeks] = useState<WeekSummary[] | null>(null);
  const [newChipWidthMm, setNewChipWidthMm] = useState("22");
  const [thisWeekLoading, setThisWeekLoading] = useState<number | null>(null);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exposureJobError, setExposureJobError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  /** current/dose/scanStep are edited via independent onBlur handlers per input, but the device-spec minimum couples all three — committing them one at a time would validate against a stale sibling value still in the DB. These refs let any of the three blurs send the other two's live (possibly-not-yet-committed) values too, so validation always reflects what's actually on screen. */
  const exposureJobInputRefs = useRef<Record<number, { currentInput?: HTMLInputElement | null; doseInput?: HTMLInputElement | null; scanStepInput?: HTMLInputElement | null }>>({});

  const job = jobs.find((j) => j.id === selectedJobId) ?? null;
  const windowOptions = job ? CASSETTE_WINDOWS[job.cassetteType] : [];
  const selectedExposureJob = exposureJobs.find((e) => e.id === selectedExposureJobId) ?? null;

  function loadJobs(selectId?: number) {
    const weekParam = viewWeekId ? `&week=${encodeURIComponent(viewWeekId)}` : "";
    fetch(`/api/chip-layout/jobs?equipmentUserId=${equipmentUserId}${weekParam}`)
      .then((r) => r.json())
      .then((list: Job[]) => {
        setJobs(list);
        setSelectedJobId((prev) => {
          if (selectId != null) return selectId;
          return prev != null && list.some((j) => j.id === prev) ? prev : list[0]?.id ?? null;
        });
      });
  }

  function loadChips(jobId: number) {
    fetch(`/api/chip-layout/jobs/${jobId}/chips`)
      .then((r) => r.json())
      .then(setChips);
  }

  function loadPatternCandidates(jobId: number) {
    fetch(`/api/chip-layout/jobs/${jobId}/patterns`)
      .then((r) => r.json())
      .then(setPatternCandidates);
  }

  function loadExposureJobs(jobId: number, selectId?: number) {
    fetch(`/api/chip-layout/jobs/${jobId}/exposure-jobs`)
      .then((r) => r.json())
      .then((list: ExposureJob[]) => {
        setExposureJobs(list);
        setSelectedExposureJobId((prev) => {
          if (selectId != null) return selectId;
          return prev != null && list.some((e) => e.id === prev) ? prev : list[0]?.id ?? null;
        });
      });
  }

  function loadPlacementInstances(exposureJobId: number) {
    fetch(`/api/chip-layout/exposure-jobs/${exposureJobId}/placements`)
      .then((r) => r.json())
      .then(setPlacementInstances);
  }

  function loadExposureSummary(jobId: number) {
    fetch(`/api/chip-layout/jobs/${jobId}/exposure-summary`)
      .then((r) => r.json())
      .then(setExposureSummary);
  }

  useEffect(() => {
    loadJobs();
    const weekParam = viewWeekId ? `?week=${encodeURIComponent(viewWeekId)}` : "";
    fetch(`/api/equipment-users/${equipmentUserId}/week-loading${weekParam}`)
      .then((r) => r.json())
      .then((d) => setThisWeekLoading(d.loadingCostMinutes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentUserId, viewWeekId]);

  function toggleWeekPicker() {
    if (!weekPickerOpen && !weeks) {
      fetch("/api/queue/weeks")
        .then((r) => r.json())
        .then(setWeeks);
    }
    setWeekPickerOpen((o) => !o);
  }

  function selectWeek(w: WeekSummary) {
    setViewWeekId(w.weekId);
    setViewingOpen(w.isOpen);
    setEditMode(false);
    setWeekPickerOpen(false);
  }

  function backToCurrentWeek() {
    setViewWeekId(null);
    setViewingOpen(true);
    setEditMode(false);
  }

  useEffect(() => {
    if (selectedJobId == null) return;
    setExposureJobError(null);
    loadChips(selectedJobId);
    loadPatternCandidates(selectedJobId);
    loadExposureJobs(selectedJobId);
    loadExposureSummary(selectedJobId);
  }, [selectedJobId]);

  useEffect(() => {
    if (selectedExposureJobId == null) {
      setPlacementInstances([]);
      return;
    }
    loadPlacementInstances(selectedExposureJobId);
  }, [selectedExposureJobId]);

  useEffect(() => {
    if (!job) return;
    setSelectedWindowKey(defaultWindowKey(job.cassetteType));
  }, [job?.cassetteType]);

  useEffect(() => {
    if (selectedExposureJob) setSelectedWindowKey(selectedExposureJob.windowKey);
  }, [selectedExposureJob]);

  function onToggleEdit() {
    if (!viewingOpen) return;
    if (editMode) {
      setEditMode(false);
      return;
    }
    if (window.confirm(t("confirmEditModeWarning"))) {
      setEditMode(true);
    }
  }

  async function addJob() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/chip-layout/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equipmentUserId }),
    });
    setBusy(false);
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? t("jobAddFailed"));
      return;
    }
    loadJobs(d.id);
  }

  async function renameJob(name: string) {
    if (!job || name === job.name) return;
    const res = await fetch(`/api/chip-layout/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = await res.json();
    if (!res.ok) setError(d.error ?? t("renameFailed"));
    loadJobs(job.id);
  }

  async function changeCassette(cassetteType: CassetteType) {
    if (!job) return;
    setError(null);
    const res = await fetch(`/api/chip-layout/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cassetteType }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? t("cassetteChangeFailed"));
      return;
    }
    loadJobs(job.id);
  }

  async function deleteJobBtn() {
    if (!job) return;
    if (!window.confirm(`"${job.name}" ${t("confirmDeleteJobGeneric")}`)) return;
    await fetch(`/api/chip-layout/jobs/${job.id}`, { method: "DELETE" });
    setSelectedJobId(null);
    loadJobs();
  }

  async function addChip() {
    if (!job) return;
    setError(null);
    const widthUm = Math.round(Number(newChipWidthMm) * MM);
    const res = await fetch(`/api/chip-layout/jobs/${job.id}/chips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windowKey: selectedWindowKey, widthUm }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? t("chipAddFailed"));
      return;
    }
    loadChips(job.id);
  }

  async function updateChipField(chipId: number, patch: Partial<{ name: string; windowKey: WindowKey; widthUm: number; centerXUm: number }>) {
    if (!job) return;
    setError(null);
    const res = await fetch(`/api/chip-layout/chips/${chipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const d = await res.json();
    if (!res.ok) setError(d.error ?? t("chipUpdateFailed"));
    loadChips(job.id);
  }

  async function deleteChipBtn(chipId: number, name: string) {
    if (!job) return;
    if (!window.confirm(`"${name}" ${t("confirmDeleteChipGeneric")}`)) return;
    await fetch(`/api/chip-layout/chips/${chipId}`, { method: "DELETE" });
    loadChips(job.id);
  }

  async function addExposureJob() {
    if (!job) return;
    setExposureJobError(null);
    const res = await fetch(`/api/chip-layout/jobs/${job.id}/exposure-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const d = await res.json();
    if (!res.ok) {
      setExposureJobError(d.error ?? t("exposureJobAddFailed"));
      return;
    }
    loadExposureJobs(job.id, d.id);
    loadExposureSummary(job.id);
  }

  async function updateExposureJobField(id: number, patch: Partial<{ currentNa: number; doseUcCm2: number; scanStep: number; windowKey: WindowKey }>) {
    if (!job) return;
    setExposureJobError(null);
    const res = await fetch(`/api/chip-layout/exposure-jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const d = await res.json();
    if (!res.ok) setExposureJobError(d.error ?? t("exposureJobUpdateFailed"));
    loadExposureJobs(job.id);
    loadExposureSummary(job.id);
    if (id === selectedExposureJobId) loadPlacementInstances(id);
  }

  /** Commits current/dose/scanStep together, reading all three inputs' live on-screen values (not just the one that triggered the blur) — the device-spec minimum scan step depends on the current/dose combo, so validating against a not-yet-committed sibling field would check the wrong pair. */
  function commitExposureJobNumericFields(ej: ExposureJob) {
    const refs = exposureJobInputRefs.current[ej.id];
    const currentNa = Number(refs?.currentInput?.value ?? ej.currentNa);
    const doseUcCm2 = Number(refs?.doseInput?.value ?? ej.doseUcCm2);
    const scanStep = Number(refs?.scanStepInput?.value ?? ej.scanStep);
    const unchanged = currentNa === ej.currentNa && doseUcCm2 === ej.doseUcCm2 && scanStep === ej.scanStep;
    // A rejected edit never persists, so `ej` (loaded from the DB) still equals whatever was valid
    // before the failed attempt — if the user "fixes" a field back to exactly that value, this looks
    // unchanged and would otherwise skip the request, leaving the stale error banner up forever.
    if (unchanged && !exposureJobError) return;
    updateExposureJobField(ej.id, { currentNa, doseUcCm2, scanStep });
  }

  async function deleteExposureJobBtn(id: number, name: string) {
    if (!job) return;
    if (!window.confirm(`"${name}" ${t("confirmDeleteExposureJobGeneric")}`)) return;
    setExposureJobError(null);
    await fetch(`/api/chip-layout/exposure-jobs/${id}`, { method: "DELETE" });
    if (selectedExposureJobId === id) setSelectedExposureJobId(null);
    loadExposureJobs(job.id);
    loadExposureSummary(job.id);
  }

  /** Reorders which pattern this slot letter shows — placement instances reference patterns by patternKey, not slot, so their displayed slot updates automatically on reload. */
  async function assignPatternSlotHandler(slotIndex: number, patternKey: string) {
    if (!job) return;
    setError(null);
    const res = await fetch(`/api/chip-layout/jobs/${job.id}/patterns/assign-slot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotIndex, patternKey }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? t("slotChangeFailed"));
    }
    loadPatternCandidates(job.id);
    if (selectedExposureJobId) loadPlacementInstances(selectedExposureJobId);
  }

  async function placePattern(patternKey: string) {
    if (!job || !selectedExposureJobId) return;
    setError(null);
    const res = await fetch(`/api/chip-layout/exposure-jobs/${selectedExposureJobId}/placements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patternKey, centerXUm: 0, centerYUm: 0 }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? t("placementFailed"));
      return;
    }
    loadPlacementInstances(selectedExposureJobId);
    loadExposureSummary(job.id);
  }

  async function updatePlacementInstanceField(id: number, patch: Partial<{ centerXUm: number; centerYUm: number }>) {
    if (!job || !selectedExposureJobId) return;
    setError(null);
    const res = await fetch(`/api/chip-layout/placement-instances/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const d = await res.json();
    if (!res.ok) setError(d.error ?? t("placementUpdateFailed"));
    loadPlacementInstances(selectedExposureJobId);
    loadExposureSummary(job.id);
  }

  async function deletePlacementInstanceBtn(id: number) {
    if (!job || !selectedExposureJobId) return;
    await fetch(`/api/chip-layout/placement-instances/${id}`, { method: "DELETE" });
    loadPlacementInstances(selectedExposureJobId);
    loadExposureSummary(job.id);
  }

  async function onLoadingBlur(value: number) {
    if (value === thisWeekLoading) return;
    setError(null);
    const res = await fetch(`/api/equipment-users/${equipmentUserId}/week-loading`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loadingCostMinutes: value }),
    });
    const d = await res.json();
    if (res.ok) setThisWeekLoading(d.loadingCostMinutes);
    else setError(d.error ?? t("loadingTimeUpdateFailed"));
  }

  async function onPreview() {
    if (!job) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/chip-layout/jobs/${job.id}/preview`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? t("previewGenerationFailed"));
      return;
    }
    // Editing is an in-progress, stateful session (selected batch/Job, unsaved-focus fields) —
    // navigating away to a full page would lose that context, so edit mode gets an overlay
    // instead. View mode has no such state to preserve, so it keeps the full page (which also
    // carries the parameter summary, too much to usefully cram into a modal).
    if (editMode) {
      setPreviewModalOpen(true);
    } else {
      router.push(`/chip-layout/${equipmentUserId}/preview/${job.id}`);
    }
  }

  const chipsInWindow = chips.filter((c) => c.windowKey === selectedWindowKey);
  const placementsInWindow = placementInstances.filter((p) => p.windowKey === selectedWindowKey);

  return (
    <div className="max-w-6xl">
      <Link href="/queue" className="text-sm opacity-60 hover:opacity-100">
        ← {t("navQueue")}
      </Link>
      <div className="flex items-center justify-between mt-2 mb-4">
        <h1 className="text-xl font-semibold">
          {equipmentUserName} ({equipmentUserAlias}) · {t("ebeamJobSettingsHeading")}
        </h1>
        <div className="relative flex items-center gap-2">
          <div>
            <button
              onClick={toggleWeekPicker}
              className="rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 text-sm opacity-70 hover:opacity-100"
            >
              {t("pastExposureListsLabel")}
            </button>
            {weekPickerOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setWeekPickerOpen(false)} />
                {/* Anchored to the button-group row, not just the button, so it
                    can't get pinned off the left edge if this row's layout
                    shifts on narrow screens. */}
                <div className="absolute right-0 top-full z-20 mt-1 w-56 max-w-[90vw] max-h-72 overflow-y-auto rounded-md border border-black/15 dark:border-white/20 bg-white dark:bg-neutral-900 py-1 shadow-lg">
                  {weeks === null ? (
                    <p className="px-3 py-2 text-xs opacity-60">{t("loadingEllipsis")}</p>
                  ) : weeks.length === 0 ? (
                    <p className="px-3 py-2 text-xs opacity-60">{t("noWeeksYet")}</p>
                  ) : (
                    weeks.map((w) => (
                      <button
                        key={w.weekId}
                        onClick={() => selectWeek(w)}
                        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {w.label}
                        {w.isOpen && <span className="opacity-50"> ({t("currentWeekTag")})</span>}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShowLoadingModal(true)}
            disabled={!editMode}
            className="rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {t("loadingTimeSettingsLabel")}
          </button>
          {viewingOpen && (
            <button
              onClick={onToggleEdit}
              className={`rounded-md px-3 py-1.5 text-sm ${
                editMode ? "border border-black/15 dark:border-white/20" : "bg-blue-600 text-white"
              }`}
            >
              {editMode ? t("viewModeLabel") : t("edit")}
            </button>
          )}
        </div>
      </div>

      {!viewingOpen && (
        <div className="flex items-center gap-2 mb-4 text-xs">
          <span className="text-amber-500">{t("viewingPastWeekNotice")}</span>
          <button onClick={backToCurrentWeek} className="underline opacity-70 hover:opacity-100">
            {t("backToCurrentWeekLabel")}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-1 overflow-x-auto">
        <select
          value={selectedJobId ?? ""}
          onChange={(e) => setSelectedJobId(Number(e.target.value))}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
        >
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
        {job && (
          <input
            key={job.id}
            defaultValue={job.name}
            disabled={!editMode}
            onBlur={(e) => renameJob(e.target.value)}
            className="w-32 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm disabled:opacity-50"
          />
        )}
        <select
          value={job?.cassetteType ?? "piece2"}
          disabled={!editMode || !job}
          onChange={(e) => changeCassette(e.target.value as CassetteType)}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm disabled:opacity-50"
        >
          <option value="piece1">cassette: piece1</option>
          <option value="piece2">cassette: piece2</option>
        </select>
        <button
          onClick={addJob}
          disabled={!editMode || busy}
          className="rounded-md border border-black/15 dark:border-white/20 px-2 py-1 text-sm disabled:opacity-50"
        >
          {t("addNewBatchLabel")}
        </button>
        <button
          onClick={deleteJobBtn}
          disabled={!editMode || !job}
          className="rounded-md border border-red-500 text-red-500 px-2 py-1 text-sm disabled:opacity-50 ml-auto"
        >
          {t("deleteBatchLabel")}
        </button>
      </div>

      {job && exposureSummary && (
        <p className="text-sm opacity-70 mb-4">
          {job.name} {t("totalEstimatedExposureLabel")}: {formatHm(exposureSummary.calculatedSeconds, lang)} (
          {t("rangeLabel")}: {formatHm(exposureSummary.minSeconds, lang)} ~ {formatHm(exposureSummary.maxSeconds, lang)})
          {thisWeekLoading != null && (
            <>
              {" "}
              + {t("loadingTimeLabel")} {formatHm(thisWeekLoading * 60, lang)}
            </>
          )}
        </p>
      )}

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      {!job && jobs.length === 0 && <p className="text-sm opacity-60">{t("noJobsLabel")}</p>}

      {job && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left column: chip management + exposure job management */}
            <div className="flex flex-col gap-4 min-w-0">
              <div className="rounded-lg border border-black/10 dark:border-white/15 p-3 min-w-0">
                <p className="text-sm font-semibold mb-2">{t("addDeleteChipLabel")}</p>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={newChipWidthMm}
                    disabled={!editMode}
                    onChange={(e) => setNewChipWidthMm(e.target.value)}
                    className="w-20 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm disabled:opacity-50"
                  />
                  <span className="text-xs opacity-60">{t("mmWidthSuffix")}</span>
                  <button
                    onClick={addChip}
                    disabled={!editMode}
                    className="rounded-md bg-blue-600 text-white px-2 py-1 text-sm disabled:opacity-50"
                  >
                    {t("addChipButtonLabel")} ({t("currentWindowInline")}: {selectedWindowKey})
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-max">
                    {chips.length > 0 && (
                      <div className="grid grid-cols-[14px_4rem_3.5rem_3.5rem_5rem_2.5rem] gap-1 text-[10px] opacity-50 mb-0.5">
                        <span />
                        <span className="text-center">{t("nameLabel")}</span>
                        <span className="text-center">window</span>
                        <span className="text-center">{t("widthMmColumnLabel")}</span>
                        <span className="text-center">center_x (µm)</span>
                        <span />
                      </div>
                    )}
                    <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
                      {chips.map((c, index) => (
                        <div key={c.id} className="grid grid-cols-[14px_4rem_3.5rem_3.5rem_5rem_2.5rem] gap-1 items-center text-xs">
                          <span
                            className="w-3 h-3 rounded-sm shrink-0 border border-black/15 dark:border-white/20"
                            style={{ backgroundColor: chipFillColor(index) }}
                          />
                          <input
                            defaultValue={c.name}
                            disabled={!editMode}
                            onBlur={(e) => e.target.value !== c.name && updateChipField(c.id, { name: e.target.value })}
                            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-1 py-0.5 disabled:opacity-50"
                          />
                          <select
                            value={c.windowKey}
                            disabled={!editMode}
                            onChange={(e) => updateChipField(c.id, { windowKey: e.target.value as WindowKey })}
                            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-1 py-0.5 disabled:opacity-50"
                          >
                            {windowOptions.map((w) => (
                              <option key={w.key} value={w.key}>
                                {w.key}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.1"
                            min={0}
                            defaultValue={c.widthUm / MM}
                            disabled={!editMode}
                            onBlur={(e) => {
                              const widthUm = Math.round(Number(e.target.value) * MM);
                              if (widthUm !== c.widthUm && widthUm > 0) updateChipField(c.id, { widthUm });
                            }}
                            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-1 py-0.5 disabled:opacity-50"
                            title={t("widthLengthTitle")}
                          />
                          <input
                            type="number"
                            defaultValue={c.centerXUm}
                            disabled={!editMode}
                            onBlur={(e) => Number(e.target.value) !== c.centerXUm && updateChipField(c.id, { centerXUm: Number(e.target.value) })}
                            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-1 py-0.5 disabled:opacity-50"
                            title="center_x (µm)"
                          />
                          <button
                            onClick={() => deleteChipBtn(c.id, c.name)}
                            disabled={!editMode}
                            className="text-red-500 disabled:opacity-50 justify-self-end"
                          >
                            {t("delete")}
                          </button>
                        </div>
                      ))}
                      {chips.length === 0 && <p className="text-xs opacity-50">{t("noChipsLabel")}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-black/10 dark:border-white/15 p-3 min-w-0">
                <p className="text-sm font-semibold mb-2">{t("addDeleteJobLabel")}</p>
                <div className="mb-2">
                  <button
                    onClick={addExposureJob}
                    disabled={!editMode}
                    className="rounded-md bg-blue-600 text-white px-2 py-1 text-sm disabled:opacity-50"
                  >
                    {t("addJobButtonLabel")}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-max">
                    {exposureJobs.length > 0 && (
                      <div className="grid grid-cols-[1.25rem_3rem_4rem_4.5rem_3.5rem_3rem_2.5rem] gap-1 text-[10px] opacity-50 mb-0.5">
                        <span />
                        <span className="text-center">{t("nameLabel")}</span>
                        <span className="text-center">current(nA)</span>
                        <span className="text-center">dose(µC/cm²)</span>
                        <span className="text-center">scan step</span>
                        <span className="text-center">window</span>
                        <span />
                      </div>
                    )}
                    <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
                      {exposureJobs.map((ej) => (
                        <div key={ej.id} className="grid grid-cols-[1.25rem_3rem_4rem_4.5rem_3.5rem_3rem_2.5rem] gap-1 items-center text-xs">
                          <input
                            type="radio"
                            name="exposureJob"
                            checked={selectedExposureJobId === ej.id}
                            onChange={() => setSelectedExposureJobId(ej.id)}
                          />
                          <span className="text-center truncate" title={ej.name}>
                            {ej.name}
                          </span>
                          <input
                            type="number"
                            defaultValue={ej.currentNa}
                            disabled={!editMode}
                            ref={(el) => {
                              (exposureJobInputRefs.current[ej.id] ??= {}).currentInput = el;
                            }}
                            onBlur={() => commitExposureJobNumericFields(ej)}
                            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-1 py-0.5 disabled:opacity-50"
                          />
                          <input
                            type="number"
                            defaultValue={ej.doseUcCm2}
                            disabled={!editMode}
                            ref={(el) => {
                              (exposureJobInputRefs.current[ej.id] ??= {}).doseInput = el;
                            }}
                            onBlur={() => commitExposureJobNumericFields(ej)}
                            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-1 py-0.5 disabled:opacity-50"
                          />
                          <input
                            type="number"
                            defaultValue={ej.scanStep}
                            disabled={!editMode}
                            ref={(el) => {
                              (exposureJobInputRefs.current[ej.id] ??= {}).scanStepInput = el;
                            }}
                            onBlur={() => commitExposureJobNumericFields(ej)}
                            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-1 py-0.5 disabled:opacity-50"
                          />
                          <select
                            value={ej.windowKey}
                            disabled={!editMode}
                            onChange={(e) => updateExposureJobField(ej.id, { windowKey: e.target.value as WindowKey })}
                            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-1 py-0.5 disabled:opacity-50"
                          >
                            {windowOptions.map((w) => (
                              <option key={w.key} value={w.key}>
                                {w.key}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => deleteExposureJobBtn(ej.id, ej.name)}
                            disabled={!editMode}
                            className="text-red-500 disabled:opacity-50 justify-self-end"
                          >
                            {t("delete")}
                          </button>
                        </div>
                      ))}
                      {exposureJobs.length === 0 && <p className="text-xs opacity-50">{t("noJobsLabel")}</p>}
                    </div>
                  </div>
                </div>
                {exposureJobError && <p className="text-xs text-red-500 mt-2">{exposureJobError}</p>}
              </div>

              {/* Pattern list | Pattern placement — shares the left column's width with chip/Job management above */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-4 min-w-0">
                <div className="rounded-lg border border-black/10 dark:border-white/15 p-3 min-w-0">
                  <p className="text-sm font-semibold mb-2">{t("patternListLabel")}</p>
                  <p className="text-xs opacity-60 mb-2">{t("patternListHint")}</p>
                  <div className="overflow-x-auto">
                    <div className="min-w-max">
                      {patternCandidates.length > 0 && (
                        <div className="grid grid-cols-[9rem_3rem_2.75rem] gap-1 text-[10px] opacity-50 mb-0.5">
                          <span className="text-center">{t("patternNameColumnLabel")}</span>
                          <span className="text-center">{t("slotColumnLabel")}</span>
                          <span />
                        </div>
                      )}
                      <div className="max-h-56 overflow-y-auto flex flex-col gap-1">
                        {patternCandidates.map((c) => (
                          <div key={c.patternKey} className="grid grid-cols-[9rem_3rem_2.75rem] gap-1 items-center text-xs">
                            <span className="whitespace-normal break-words leading-tight py-0.5">{c.candidateLabel}</span>
                            <select
                              value={c.slotIndex}
                              disabled={!editMode}
                              onChange={(e) => assignPatternSlotHandler(Number(e.target.value), c.patternKey)}
                              className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-1 py-0.5 disabled:opacity-50"
                            >
                              {patternCandidates.map((opt) => (
                                <option key={opt.slotIndex} value={opt.slotIndex}>
                                  {opt.slotLetter}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => placePattern(c.patternKey)}
                              disabled={!editMode || !selectedExposureJobId}
                              className="rounded-md border border-black/15 dark:border-white/20 px-0.5 py-0.5 text-[10px] whitespace-nowrap disabled:opacity-50"
                            >
                              {t("placeButtonLabel")}
                            </button>
                          </div>
                        ))}
                        {patternCandidates.length === 0 && <p className="text-xs opacity-50">{t("noPatternsThisWeekLabel")}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-black/10 dark:border-white/15 p-3 min-w-0">
                  <p className="text-sm font-semibold mb-2">
                    {t("patternPlacementLabel")} · {selectedExposureJob?.name ?? "-"}
                  </p>
                  <div className="overflow-x-auto">
                    <div className="min-w-max">
                      {placementInstances.length > 0 && (
                        <div className="grid grid-cols-[1.25rem_5rem_5rem_2.5rem] gap-1 text-[10px] opacity-50 mb-0.5">
                          <span className="text-center">{t("slotColumnLabel")}</span>
                          <span className="text-center">center_x (µm)</span>
                          <span className="text-center">center_y (µm)</span>
                          <span />
                        </div>
                      )}
                      <div className="max-h-56 overflow-y-auto flex flex-col gap-1">
                        {placementInstances.map((p) => (
                          <div key={p.id} className="grid grid-cols-[1.25rem_5rem_5rem_2.5rem] gap-1 items-center text-xs">
                            <span className="font-semibold text-center" title={p.candidateLabel}>
                              {p.slotLetter}
                            </span>
                            <input
                              type="number"
                              defaultValue={p.centerXUm}
                              disabled={!editMode}
                              onBlur={(e) => Number(e.target.value) !== p.centerXUm && updatePlacementInstanceField(p.id, { centerXUm: Number(e.target.value) })}
                              className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-1 py-0.5 disabled:opacity-50"
                              title="center_x (µm)"
                            />
                            <input
                              type="number"
                              defaultValue={p.centerYUm}
                              disabled={!editMode}
                              onBlur={(e) => Number(e.target.value) !== p.centerYUm && updatePlacementInstanceField(p.id, { centerYUm: Number(e.target.value) })}
                              className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-1 py-0.5 disabled:opacity-50"
                              title="center_y (µm)"
                            />
                            <button
                              onClick={() => deletePlacementInstanceBtn(p.id)}
                              disabled={!editMode}
                              className="text-red-500 disabled:opacity-50 justify-self-end"
                            >
                              {t("delete")}
                            </button>
                          </div>
                        ))}
                        {placementInstances.length === 0 && <p className="text-xs opacity-50">{t("noPlacedPatternsLabel")}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column: cassette + window canvas */}
            <div className="flex flex-col gap-3 min-w-0">
              <div className="rounded-lg border border-black/10 dark:border-white/15 p-3 min-w-0">
                <div className="flex items-center gap-3 mb-3 overflow-x-auto">
                  <span className="text-sm whitespace-nowrap shrink-0 opacity-70">cassette: {job.cassetteType}</span>
                  <label className="flex items-center gap-1 text-sm whitespace-nowrap shrink-0">
                    Window
                    <select
                      value={selectedWindowKey}
                      onChange={(e) => setSelectedWindowKey(e.target.value as WindowKey)}
                      className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
                    >
                      {windowOptions.map((w) => (
                        <option key={w.key} value={w.key}>
                          {w.key}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="overflow-x-auto">
                  {windowOptions.length > 0 && (
                    <WindowCanvas
                      widthUm={windowOptions.find((w) => w.key === selectedWindowKey)!.widthUm}
                      heightUm={windowOptions.find((w) => w.key === selectedWindowKey)!.heightUm}
                      chips={chipsInWindow.map((c) => ({
                        id: c.id,
                        name: c.name,
                        centerXUm: c.centerXUm,
                        widthUm: c.widthUm,
                        color: chipFillColor(chips.findIndex((all) => all.id === c.id)),
                      }))}
                      patterns={placementsInWindow.map((p) => ({
                        key: `instance-${p.id}`,
                        label: p.slotLetter,
                        centerXUm: p.centerXUm,
                        centerYUm: p.centerYUm,
                        sizeXUm: p.sizeXUm,
                        sizeYUm: p.sizeYUm,
                      }))}
                    />
                  )}
                </div>
                {windowOptions.length > 0 && (
                  <p className="text-xs opacity-60 text-right mt-1">
                    Window: {windowOptions.find((w) => w.key === selectedWindowKey)!.heightUm / MM}mm
                  </p>
                )}
                <p className="text-xs opacity-50 mt-1">
                  {t("windowOnlyShowsHintPrefix")} &quot;{selectedExposureJob?.name ?? "-"}&quot;
                  {t("windowOnlyShowsHintSuffix")}
                </p>

                <button
                  onClick={onPreview}
                  disabled={busy}
                  className="mt-3 rounded-md bg-blue-600 text-white px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {editMode ? t("fullPatternViewLabel") : t("fullPatternViewSummaryLabel")}
                </button>
              </div>
            </div>
          </div>
          )}

          {previewModalOpen && job && (
            <ChipLayoutPreviewModal
              jobId={job.id}
              jobName={job.name}
              windowOptions={windowOptions.map((w) => w.key)}
              initialWindowKey={selectedWindowKey}
              onClose={() => setPreviewModalOpen(false)}
            />
      )}

      {showLoadingModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowLoadingModal(false)}
        >
          <div
            className="bg-white dark:bg-neutral-900 rounded-lg p-4 max-w-sm w-full border border-black/10 dark:border-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold mb-2">{t("loadingTimeSettingsLabel")}</h2>
            <p className="text-sm opacity-70 mb-3">
              {t("loadingTimeModalHintPrefix")} {defaultLoadingCostMinutes}
              {t("loadingTimeModalHintSuffix")}
            </p>
            <div className="flex items-center gap-2 mb-4">
              <input
                key={thisWeekLoading ?? 0}
                type="number"
                min={0}
                defaultValue={thisWeekLoading ?? 0}
                onBlur={(e) => onLoadingBlur(Number(e.target.value))}
                className="w-24 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
              />
              <span className="text-xs opacity-60">{t("minutesUnit")}</span>
            </div>
            <button
              onClick={() => setShowLoadingModal(false)}
              className="w-full rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 text-sm"
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
