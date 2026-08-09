"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import autoAnimate from "@formkit/auto-animate";
import { displayFilename } from "@/lib/photo-display";
import type { ChipRunDetail } from "@/lib/data";
import { STAGE_TYPES, STAGE_STATUSES } from "@/lib/stage-constants";
import { useLanguage } from "@/components/LanguageContext";

interface OtherChipRun {
  id: number;
  label: string;
  projectName: string;
}

interface ProjectOption {
  id: number;
  slug: string;
  name: string;
}

interface DraggedPhoto {
  crpId: number;
  fromStageId: number;
}

export default function ChipRunAdminEditor({ chipRun }: { chipRun: ChipRunDetail }) {
  const router = useRouter();
  const [newStageType, setNewStageType] = useState<string>(STAGE_TYPES[0]);
  const [newStageLabel, setNewStageLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [otherRuns, setOtherRuns] = useState<OtherChipRun[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectSaved, setProjectSaved] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<number | "">("");
  const [labelInput, setLabelInput] = useState(chipRun.label);
  const [labelSaved, setLabelSaved] = useState(false);
  const [uploadingStageId, setUploadingStageId] = useState<number | null>(null);

  const [draggedStageId, setDraggedStageId] = useState<number | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<number | null>(null);
  const [draggedPhoto, setDraggedPhoto] = useState<DraggedPhoto | null>(null);
  const [dragOverPhotoCrpId, setDragOverPhotoCrpId] = useState<number | null>(null);
  const [openMenuStageId, setOpenMenuStageId] = useState<number | null>(null);
  const [moveModalStageId, setMoveModalStageId] = useState<number | null>(null);
  const [moveModalTarget, setMoveModalTarget] = useState<number | "">("");
  const { lang, t } = useLanguage();
  const [stagesListRef] = useAutoAnimate<HTMLDivElement>();
  // Stable identity across re-renders (unlike an inline arrow function) so autoAnimate
  // initializes once per photos-list DOM node instead of re-running on every re-render —
  // this component re-renders a lot during drag-hover state changes.
  const photosListRef = useCallback((el: HTMLDivElement | null) => {
    if (el) autoAnimate(el);
  }, []);

  useEffect(() => {
    setLabelInput(chipRun.label);
  }, [chipRun.id, chipRun.label]);

  useEffect(() => {
    fetch("/api/admin/chip-runs")
      .then((r) => r.json())
      .then((all: { id: number; label: string; projectName: string }[]) =>
        setOtherRuns(all.filter((r) => r.id !== chipRun.id)),
      );
  }, [chipRun.id]);

  useEffect(() => {
    fetch("/api/admin/projects")
      .then((r) => r.json())
      .then(setProjects);
  }, []);

  async function updateProject(projectId: number) {
    setBusy(true);
    await fetch(`/api/admin/chip-runs/${chipRun.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    setBusy(false);
    setProjectSaved(true);
    setTimeout(() => setProjectSaved(false), 2000);
    router.refresh();
  }

  async function updateStage(id: number, patch: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/admin/stages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusy(false);
    router.refresh();
  }

  async function persistStageOrder(orderedStageIds: number[]) {
    setBusy(true);
    await fetch(`/api/admin/chip-runs/${chipRun.id}/stages/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedStageIds }),
    });
    setBusy(false);
    router.refresh();
  }

  async function deleteStage(id: number) {
    if (!confirm(t("confirmDeleteStage"))) return;
    setBusy(true);
    await fetch(`/api/admin/stages/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  async function moveStage(stageId: number, targetChipRunId: number) {
    setBusy(true);
    await fetch(`/api/admin/stages/${stageId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetChipRunId }),
    });
    setBusy(false);
    router.refresh();
  }

  async function movePhoto(crpId: number, targetStageId: number) {
    setBusy(true);
    await fetch(`/api/admin/chip-run-photos/${crpId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetStageId }),
    });
    setBusy(false);
    router.refresh();
  }

  async function persistPhotoOrder(stageId: number, orderedCrpIds: number[]) {
    setBusy(true);
    await fetch(`/api/admin/stages/${stageId}/photos/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedCrpIds }),
    });
    setBusy(false);
    router.refresh();
  }

  async function uploadPhoto(stageId: number, file: File) {
    setUploadingStageId(stageId);
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/admin/stages/${stageId}/photos`, { method: "POST", body: form });
    setBusy(false);
    setUploadingStageId(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? t("photoUploadFailed"));
      return;
    }
    router.refresh();
  }

  async function deletePhoto(crpId: number) {
    setBusy(true);
    await fetch(`/api/admin/chip-run-photos/${crpId}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  async function addStage() {
    setBusy(true);
    await fetch(`/api/admin/chip-runs/${chipRun.id}/stages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageType: newStageType, label: newStageLabel || null }),
    });
    setNewStageLabel("");
    setBusy(false);
    router.refresh();
  }

  async function clearReview() {
    setBusy(true);
    await fetch(`/api/admin/chip-runs/${chipRun.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearReview: true }),
    });
    setBusy(false);
    router.refresh();
  }

  async function updateLabel(label: string) {
    if (!label.trim() || label === chipRun.label) return;
    setBusy(true);
    await fetch(`/api/admin/chip-runs/${chipRun.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setBusy(false);
    setLabelSaved(true);
    setTimeout(() => setLabelSaved(false), 2000);
    router.refresh();
  }

  async function mergeIntoTarget() {
    if (!mergeTargetId) return;
    const targetLabel = otherRuns.find((r) => r.id === mergeTargetId)?.label ?? "";
    const warned = confirm(
      lang === "ko"
        ? `"${chipRun.label}"의 모든 스테이지를 "${targetLabel}"로 옮기고, "${chipRun.label}"은 삭제됩니다. 되돌릴 수 없습니다. 계속할까요?`
        : `All stages of "${chipRun.label}" will be moved to "${targetLabel}", and "${chipRun.label}" will be deleted. This cannot be undone. Continue?`,
    );
    if (!warned) return;
    setBusy(true);
    const res = await fetch("/api/admin/chip-runs/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: chipRun.id, targetId: mergeTargetId }),
    });
    setBusy(false);
    if (res.ok) router.push(`/admin/chips/${mergeTargetId}/edit`);
  }

  function handleStageDragStart(id: number) {
    setDraggedStageId(id);
  }

  function handleStageDragEnd() {
    setDraggedStageId(null);
    setDragOverStageId(null);
  }

  function handleCardDragOver(e: React.DragEvent, stageId: number) {
    e.preventDefault();
    if (draggedStageId === null && draggedPhoto === null) return;
    setDragOverStageId(stageId);
  }

  function handleCardDragLeave(stageId: number) {
    setDragOverStageId((cur) => (cur === stageId ? null : cur));
  }

  function handleCardDrop(e: React.DragEvent, targetStageId: number) {
    e.preventDefault();
    setDragOverStageId(null);

    if (draggedPhoto) {
      const { crpId, fromStageId } = draggedPhoto;
      setDraggedPhoto(null);
      if (fromStageId !== targetStageId) movePhoto(crpId, targetStageId);
      return;
    }

    if (draggedStageId !== null) {
      const sourceId = draggedStageId;
      setDraggedStageId(null);
      if (sourceId !== targetStageId) {
        const ids = chipRun.stages.map((s) => s.id);
        const from = ids.indexOf(sourceId);
        const to = ids.indexOf(targetStageId);
        ids.splice(from, 1);
        ids.splice(to, 0, sourceId);
        persistStageOrder(ids);
      }
    }
  }

  function handlePhotoDragOver(e: React.DragEvent, crpId: number) {
    e.preventDefault();
    e.stopPropagation();
    if (draggedPhoto === null) return;
    setDragOverPhotoCrpId(crpId);
  }

  function handlePhotoDragLeave(crpId: number) {
    setDragOverPhotoCrpId((cur) => (cur === crpId ? null : cur));
  }

  function handlePhotoDrop(e: React.DragEvent, stage: ChipRunDetail["stages"][number], targetCrpId: number) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverStageId(null);
    setDragOverPhotoCrpId(null);
    if (!draggedPhoto) return;
    const { crpId: sourceCrpId, fromStageId } = draggedPhoto;
    setDraggedPhoto(null);

    if (fromStageId !== stage.id) {
      movePhoto(sourceCrpId, stage.id);
      return;
    }
    if (sourceCrpId === targetCrpId) return;

    const ids = stage.photos.map((p) => p.crpId);
    const from = ids.indexOf(sourceCrpId);
    const to = ids.indexOf(targetCrpId);
    ids.splice(from, 1);
    ids.splice(to, 0, sourceCrpId);
    persistPhotoOrder(stage.id, ids);
  }

  function openMoveModal(stageId: number) {
    setMoveModalTarget("");
    setMoveModalStageId(stageId);
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-60">{t("runNameLabel")}</span>
        <div className="flex items-center gap-2">
          <input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onBlur={(e) => updateLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 font-medium"
          />
          <button
            onClick={() => updateLabel(labelInput)}
            disabled={busy || !labelInput.trim() || labelInput === chipRun.label}
            className="text-xs rounded-md border border-black/15 dark:border-white/20 px-3 py-2 disabled:opacity-50"
          >
            {t("save")}
          </button>
          {labelSaved && <span className="text-xs text-green-500">{t("saved")}</span>}
        </div>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-60">{t("belongsToProjectLabel")}</span>
        <div className="flex items-center gap-2">
          <select
            value={projects.find((p) => p.slug === chipRun.projectSlug)?.id ?? ""}
            onChange={(e) => updateProject(Number(e.target.value))}
            disabled={busy}
            className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 disabled:opacity-50"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {projectSaved && <span className="text-xs text-green-500">{t("saved")}</span>}
        </div>
      </label>

      {chipRun.needsReview && (
        <div className="flex items-center justify-between rounded-md border border-amber-500 px-3 py-2 text-sm">
          <span>
            {t("needsReviewConfidencePrefix")} (confidence {chipRun.llmConfidence?.toFixed(2)})
          </span>
          <button onClick={clearReview} disabled={busy} className="underline">
            {t("markReviewedLabel")}
          </button>
        </div>
      )}

      <div ref={stagesListRef} className="flex flex-col gap-3">
        {chipRun.stages.map((stage) => (
          <div
            key={stage.id}
            onDragOver={(e) => handleCardDragOver(e, stage.id)}
            onDragLeave={() => handleCardDragLeave(stage.id)}
            onDrop={(e) => handleCardDrop(e, stage.id)}
            className={`rounded-lg border p-3 transition-colors ${
              dragOverStageId === stage.id
                ? "border-blue-500"
                : "border-black/10 dark:border-white/15"
            } ${draggedStageId === stage.id ? "opacity-40" : ""}`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span
                draggable
                onDragStart={() => handleStageDragStart(stage.id)}
                onDragEnd={handleStageDragEnd}
                className="cursor-grab select-none px-1 text-sm opacity-40 hover:opacity-70"
                aria-label={t("dragToReorderLabel")}
                title={t("dragToReorderLabel")}
              >
                ⠿
              </span>
              <span className="text-sm font-medium">
                {stage.stageType} (seq {stage.seq})
              </span>
              <select
                value={stage.status}
                onChange={(e) => updateStage(stage.id, { status: e.target.value })}
                className="text-xs rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
              >
                {STAGE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <div className="relative ml-auto">
                <button
                  onClick={() => setOpenMenuStageId((cur) => (cur === stage.id ? null : stage.id))}
                  className="rounded-md px-2 py-1 text-sm leading-none hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label={t("moreOptionsLabel")}
                  title={t("moreOptionsLabel")}
                >
                  ⋮
                </button>
                {openMenuStageId === stage.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenuStageId(null)} />
                    <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-black/15 dark:border-white/20 bg-white dark:bg-neutral-900 py-1 shadow-lg">
                      <button
                        onClick={() => {
                          setOpenMenuStageId(null);
                          openMoveModal(stage.id);
                        }}
                        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {t("moveToOtherChipRunLabel")}
                      </button>
                      <button
                        onClick={() => {
                          setOpenMenuStageId(null);
                          deleteStage(stage.id);
                        }}
                        className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {t("delete")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <textarea
              defaultValue={stage.label ?? ""}
              onBlur={(e) => updateStage(stage.id, { label: e.target.value })}
              placeholder={t("memoPlaceholder")}
              rows={2}
              className="mt-2 w-full resize-y whitespace-pre-wrap text-sm rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
            />
            <div className="mt-2 flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1">
                <span className="opacity-50">{t("startDateLabel")}</span>
                <input
                  type="date"
                  defaultValue={stage.startedDate ?? ""}
                  onChange={(e) => updateStage(stage.id, { startedDate: e.target.value || null })}
                  className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
                />
              </label>
              <label className="flex items-center gap-1">
                <span className="opacity-50">{t("endDateLabel")}</span>
                <input
                  type="date"
                  defaultValue={stage.completedDate ?? ""}
                  onChange={(e) => updateStage(stage.id, { completedDate: e.target.value || null })}
                  className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
                />
              </label>
            </div>
            {stage.status === "blocked" && (
              <input
                defaultValue={stage.blockedReason ?? ""}
                onBlur={(e) => updateStage(stage.id, { status: "blocked", blockedReason: e.target.value })}
                placeholder={t("blockedReasonPlaceholder")}
                className="mt-2 w-full text-sm rounded-md border border-red-500/40 bg-transparent px-2 py-1"
              />
            )}
            {stage.photos.length > 0 && (
              <div ref={photosListRef} className="mt-2 flex flex-wrap gap-3">
                {stage.photos.map((photo) => (
                  <div
                    key={photo.crpId}
                    draggable
                    onDragStart={() => setDraggedPhoto({ crpId: photo.crpId, fromStageId: stage.id })}
                    onDragEnd={() => {
                      setDraggedPhoto(null);
                      setDragOverPhotoCrpId(null);
                    }}
                    onDragOver={(e) => handlePhotoDragOver(e, photo.crpId)}
                    onDragLeave={() => handlePhotoDragLeave(photo.crpId)}
                    onDrop={(e) => handlePhotoDrop(e, stage, photo.crpId)}
                    className={`relative flex w-[6.5rem] cursor-grab flex-col items-center gap-1 rounded ${
                      dragOverPhotoCrpId === photo.crpId ? "ring-2 ring-blue-500" : ""
                    } ${draggedPhoto?.crpId === photo.crpId ? "opacity-40" : ""}`}
                    title={displayFilename(photo.filename)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/photos/${photo.id}`}
                      alt={displayFilename(photo.filename)}
                      className="h-[6.25rem] w-[6.25rem] rounded object-cover border border-black/10 dark:border-white/15"
                    />
                    <button
                      onClick={() => deletePhoto(photo.crpId)}
                      disabled={busy}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs leading-none text-white disabled:opacity-50"
                      aria-label={t("deletePhotoLabel")}
                      title={t("deletePhotoLabel")}
                    >
                      ×
                    </button>
                    <span className="w-full truncate text-center text-[10px] opacity-60">{displayFilename(photo.filename)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-xs opacity-50">{t("photoAttachLabel")}</span>
              <label
                htmlFor={`photo-upload-${stage.id}`}
                className={`cursor-pointer rounded-md border border-black/15 dark:border-white/20 px-2 py-1 text-xs ${
                  busy ? "opacity-50 pointer-events-none" : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {t("chooseFileLabel")}
              </label>
              <input
                id={`photo-upload-${stage.id}`}
                type="file"
                accept="image/*,.pdf"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) uploadPhoto(stage.id, file);
                }}
                className="hidden"
              />
              {uploadingStageId === stage.id && <span className="text-xs opacity-50">{t("uploadingEllipsis")}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-black/20 dark:border-white/25 p-3 flex items-center gap-2">
        <select
          value={newStageType}
          onChange={(e) => setNewStageType(e.target.value)}
          className="text-sm rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
        >
          {STAGE_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          value={newStageLabel}
          onChange={(e) => setNewStageLabel(e.target.value)}
          placeholder={t("memoOptionalPlaceholder")}
          className="flex-1 text-sm rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
        />
        <button
          onClick={addStage}
          disabled={busy}
          className="text-sm rounded-md bg-blue-600 text-white px-3 py-1 disabled:opacity-50"
        >
          {t("addStageLabel")}
        </button>
      </div>

      <div className="rounded-lg border border-red-500/30 p-3 flex items-center gap-2">
        <span className="text-sm">{t("mergeEntireChipRunLabel")}</span>
        <select
          value={mergeTargetId}
          onChange={(e) => setMergeTargetId(Number(e.target.value) || "")}
          className="text-xs rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 max-w-[10rem] truncate"
        >
          <option value="">{t("selectEllipsis")}</option>
          {otherRuns.map((r) => (
            <option key={r.id} value={r.id}>
              {r.projectName} · {r.label}
            </option>
          ))}
        </select>
        <button
          onClick={mergeIntoTarget}
          disabled={busy || !mergeTargetId}
          className="text-xs rounded-md border border-red-500 text-red-500 px-2 py-1 disabled:opacity-50"
        >
          {t("mergeConfirmButtonLabel")}
        </button>
      </div>

      {moveModalStageId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setMoveModalStageId(null)}
        >
          <div
            className="w-80 rounded-lg border border-black/15 dark:border-white/20 bg-white dark:bg-neutral-900 p-4 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-medium">{t("moveToOtherChipRunLabel")}</h4>
            <select
              value={moveModalTarget}
              onChange={(e) => setMoveModalTarget(Number(e.target.value) || "")}
              className="text-sm rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
              autoFocus
            >
              <option value="">{t("selectTargetChipRunLabel")}</option>
              {otherRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.projectName} · {r.label}
                </option>
              ))}
            </select>
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => setMoveModalStageId(null)}
                className="text-xs rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5"
              >
                {t("cancel")}
              </button>
              <button
                onClick={async () => {
                  if (!moveModalTarget || moveModalStageId === null) return;
                  await moveStage(moveModalStageId, moveModalTarget);
                  setMoveModalStageId(null);
                }}
                disabled={busy || !moveModalTarget}
                className="text-xs rounded-md bg-blue-600 text-white px-3 py-1.5 disabled:opacity-50"
              >
                {t("moveLabel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
