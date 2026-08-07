"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RecipeEntryRow } from "@/lib/data";

interface OtherRecipe {
  recipeName: string;
  entryCount: number;
}

export default function RecipeAdminEditor({
  categorySlug,
  recipeName,
  entries,
  description,
  entryMode,
}: {
  categorySlug: string;
  recipeName: string;
  entries: RecipeEntryRow[];
  description: string | null;
  entryMode: "full" | "log_only";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [otherRecipes, setOtherRecipes] = useState<OtherRecipe[]>([]);
  const [mergeTarget, setMergeTarget] = useState("");
  const [descriptionInput, setDescriptionInput] = useState(description ?? "");
  const [descriptionSaved, setDescriptionSaved] = useState(false);
  const [logOnly, setLogOnly] = useState(entryMode === "log_only");

  useEffect(() => {
    fetch(`/api/admin/recipes?category=${categorySlug}`)
      .then((r) => r.json())
      .then((all: OtherRecipe[]) => setOtherRecipes(all.filter((r) => r.recipeName !== recipeName)));
  }, [categorySlug, recipeName]);

  async function renameTo(newName: string) {
    if (!newName.trim() || newName === recipeName) return;
    setRenameError(null);
    setBusy(true);
    const res = await fetch("/api/admin/recipes/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorySlug, oldName: recipeName, newName }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setRenameError(d.error ?? "이름 변경 실패");
      return;
    }
    router.push(`/admin/recipes/${categorySlug}/${encodeURIComponent(newName)}/edit`);
  }

  async function mergeIntoTarget() {
    if (!mergeTarget) return;
    const warned = confirm(
      `"${recipeName}"의 모든 기록(${entries.length}건)을 "${mergeTarget}"로 합칩니다. 되돌릴 수 없습니다. 계속할까요?`,
    );
    if (!warned) return;
    await renameTo(mergeTarget);
  }

  async function deleteRecipe() {
    const warned = confirm(
      `"${recipeName}"의 모든 기록(${entries.length}건)이 전부 삭제되고 되돌릴 수 없습니다. 정말 삭제하시겠습니까?`,
    );
    if (!warned) return;
    setBusy(true);
    await fetch(
      `/api/admin/recipes?category=${encodeURIComponent(categorySlug)}&recipeName=${encodeURIComponent(recipeName)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    router.push(`/admin/recipes/${categorySlug}`);
  }

  async function saveDescription() {
    setBusy(true);
    await fetch("/api/admin/recipes/description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorySlug, recipeName, description: descriptionInput }),
    });
    setBusy(false);
    setDescriptionSaved(true);
    setTimeout(() => setDescriptionSaved(false), 2000);
  }

  async function toggleLogOnly(next: boolean) {
    setLogOnly(next);
    setBusy(true);
    await fetch("/api/admin/recipes/entry-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorySlug, recipeName, entryMode: next ? "log_only" : "full" }),
    });
    setBusy(false);
    router.refresh();
  }

  async function updateEntry(id: number, patch: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/admin/recipes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusy(false);
    router.refresh();
  }

  async function deleteEntry(id: number) {
    if (!confirm("이 레시피 기록을 삭제할까요?")) return;
    setBusy(true);
    await fetch(`/api/admin/recipes/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-60">레시피 이름 (같은 이름의 모든 기록에 일괄 적용)</span>
        <input
          defaultValue={recipeName}
          onBlur={(e) => renameTo(e.target.value)}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 font-medium"
        />
        {renameError && <p className="text-sm text-red-500">{renameError}</p>}
      </label>

      <div className="rounded-lg border border-red-500/30 p-3 flex items-center gap-2 flex-wrap">
        <span className="text-sm">이 레시피를 다른 레시피로 병합:</span>
        <select
          value={mergeTarget}
          onChange={(e) => setMergeTarget(e.target.value)}
          className="text-xs rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 max-w-[10rem] truncate"
        >
          <option value="">선택...</option>
          {otherRecipes.map((r) => (
            <option key={r.recipeName} value={r.recipeName}>
              {r.recipeName} ({r.entryCount}건)
            </option>
          ))}
        </select>
        <button
          onClick={mergeIntoTarget}
          disabled={busy || !mergeTarget}
          className="text-xs rounded-md border border-red-500 text-red-500 px-2 py-1 disabled:opacity-50"
        >
          병합
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm rounded-lg border border-black/10 dark:border-white/15 p-3">
        <input type="checkbox" checked={logOnly} onChange={(e) => toggleLogOnly(e.target.checked)} disabled={busy} />
        <span>
          이 레시피는 <strong>설명만 기록</strong> — 파라미터는 아래 설명란에만 적고, 각 기록은 사용 날짜만 남깁니다.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-60">
          {logOnly
            ? "레시피 설명 (이 레시피의 모든 내용 — 고정 조건과 사용 이력을 여기에 자유롭게 기록)"
            : "레시피 설명 (고정 스텝/파라미터 — 여기 기록된 내용은 아래 각 기록에 반복해서 적지 않아도 됩니다)"}
        </span>
        <textarea
          value={descriptionInput}
          onChange={(e) => setDescriptionInput(e.target.value)}
          rows={6}
          placeholder="예: RF power 100W, 압력 10mTorr, 가스비 CF4:O2 = 4:1, ..."
          className="w-full text-sm rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={saveDescription}
            disabled={busy}
            className="text-xs rounded-md border border-black/15 dark:border-white/20 px-3 py-1 disabled:opacity-50"
          >
            저장
          </button>
          {descriptionSaved && <span className="text-xs text-green-500">저장됨</span>}
        </div>
      </label>

      <div className="rounded-lg border border-red-500/30 p-3 flex items-center gap-2">
        <span className="text-sm">이 레시피 전체 삭제:</span>
        <button
          onClick={deleteRecipe}
          disabled={busy}
          className="text-xs rounded-md border border-red-500 text-red-500 px-2 py-1 disabled:opacity-50 ml-auto"
        >
          삭제 ({entries.length}건 전체)
        </button>
      </div>

      {!logOnly && (
        <p className="text-xs text-gray-500 dark:text-gray-400">파라미터는 json 형식으로 기록해 주셔야 합니다.</p>
      )}
      {!logOnly && categorySlug === "etching" && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          resist_thickness_nm 가 명시되어 있어야 resist strip 전/후 단차 (pre_strip_step_height,
          post_strip_step_height)로 resist selectivity를 자동으로 계산합니다.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {entries
          .slice()
          .reverse()
          .map((e) => (
            <div key={e.id} className="rounded-lg border border-black/10 dark:border-white/15 p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{e.entryDate}</span>
                <button onClick={() => deleteEntry(e.id)} className="text-xs text-red-500 ml-auto">
                  삭제
                </button>
              </div>
              {logOnly ? (
                <textarea
                  defaultValue={e.sourceExcerpt}
                  onBlur={(ev) => {
                    if (ev.target.value !== e.sourceExcerpt) updateEntry(e.id, { sourceExcerpt: ev.target.value });
                  }}
                  placeholder="이 날짜 로그에 대한 비고"
                  rows={2}
                  className="mt-2 w-full text-xs rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
                />
              ) : (
                <>
                  <textarea
                    defaultValue={JSON.stringify(e.params, null, 2)}
                    onBlur={(ev) => {
                      try {
                        const parsed = JSON.parse(ev.target.value);
                        updateEntry(e.id, { params: parsed });
                      } catch {
                        alert("올바른 JSON 형식이 아닙니다.");
                      }
                    }}
                    rows={Math.min(10, Object.keys(e.params).length + 2)}
                    className="mt-2 w-full text-xs font-mono rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1"
                  />
                  <p className="mt-1 text-xs opacity-50">{e.sourceExcerpt}</p>
                </>
              )}
            </div>
          ))}
      </div>
      {busy && <p className="text-xs opacity-50">저장 중...</p>}
    </div>
  );
}
