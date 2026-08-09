"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RecipeEntryRow } from "@/lib/data";
import RecipeEventAdmin from "@/components/RecipeEventAdmin";
import { useLanguage } from "@/components/LanguageContext";

const TREND_CATEGORIES = new Set(["etching", "deposition"]);

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
  const { lang, t } = useLanguage();

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
      setRenameError(d.error ?? t("renameFailed"));
      return;
    }
    router.push(`/admin/recipes/${categorySlug}/${encodeURIComponent(newName)}/edit`);
  }

  async function mergeIntoTarget() {
    if (!mergeTarget) return;
    const warned = confirm(
      lang === "ko"
        ? `"${recipeName}"의 모든 기록(${entries.length}건)을 "${mergeTarget}"로 합칩니다. 되돌릴 수 없습니다. 계속할까요?`
        : `This will merge all ${entries.length} entries of "${recipeName}" into "${mergeTarget}". This cannot be undone. Continue?`,
    );
    if (!warned) return;
    await renameTo(mergeTarget);
  }

  async function deleteRecipe() {
    const warned = confirm(
      lang === "ko"
        ? `"${recipeName}"의 모든 기록(${entries.length}건)이 전부 삭제되고 되돌릴 수 없습니다. 정말 삭제하시겠습니까?`
        : `All ${entries.length} entries of "${recipeName}" will be permanently deleted. This cannot be undone. Delete anyway?`,
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
    if (!confirm(t("confirmDeleteRecipeEntry"))) return;
    setBusy(true);
    await fetch(`/api/admin/recipes/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-60">{t("recipeNameApplyAllLabel")}</span>
        <input
          defaultValue={recipeName}
          onBlur={(e) => renameTo(e.target.value)}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 font-medium"
        />
        {renameError && <p className="text-sm text-red-500">{renameError}</p>}
      </label>

      <div className="rounded-lg border border-red-500/30 p-3 flex items-center gap-2 flex-wrap">
        <span className="text-sm">{t("mergeIntoOtherRecipeLabel")}</span>
        <select
          value={mergeTarget}
          onChange={(e) => setMergeTarget(e.target.value)}
          className="text-xs rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 max-w-[10rem] truncate"
        >
          <option value="">{t("selectEllipsis")}</option>
          {otherRecipes.map((r) => (
            <option key={r.recipeName} value={r.recipeName}>
              {r.recipeName} ({r.entryCount}
              {lang === "ko" ? "건" : ` ${t("entriesLabel")}`})
            </option>
          ))}
        </select>
        <button
          onClick={mergeIntoTarget}
          disabled={busy || !mergeTarget}
          className="text-xs rounded-md border border-red-500 text-red-500 px-2 py-1 disabled:opacity-50"
        >
          {t("mergeButtonLabel")}
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm rounded-lg border border-black/10 dark:border-white/15 p-3">
        <input type="checkbox" checked={logOnly} onChange={(e) => toggleLogOnly(e.target.checked)} disabled={busy} />
        <span>
          <strong>{t("logOnlyToggleLabel")}</strong> {t("logOnlyToggleSuffix")}
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-60">{logOnly ? t("recipeDescriptionFreeform") : t("recipeDescriptionFixedSteps")}</span>
        <textarea
          value={descriptionInput}
          onChange={(e) => setDescriptionInput(e.target.value)}
          rows={6}
          placeholder={t("recipeDescriptionExamplePlaceholder")}
          className="w-full text-sm rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={saveDescription}
            disabled={busy}
            className="text-xs rounded-md border border-black/15 dark:border-white/20 px-3 py-1 disabled:opacity-50"
          >
            {t("save")}
          </button>
          {descriptionSaved && <span className="text-xs text-green-500">{t("saved")}</span>}
        </div>
      </label>

      {TREND_CATEGORIES.has(categorySlug) && (
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-3">
          <RecipeEventAdmin categorySlug={categorySlug} recipeName={recipeName} />
        </div>
      )}

      <div className="rounded-lg border border-red-500/30 p-3 flex items-center gap-2">
        <span className="text-sm">{t("deleteEntireRecipeLabel")}</span>
        <button
          onClick={deleteRecipe}
          disabled={busy}
          className="text-xs rounded-md border border-red-500 text-red-500 px-2 py-1 disabled:opacity-50 ml-auto"
        >
          {t("delete")} ({entries.length}
          {lang === "ko" ? "건" : ""} {t("deleteAllEntriesLabel")})
        </button>
      </div>

      {!logOnly && <p className="text-xs text-gray-500 dark:text-gray-400">{t("paramsJsonHint")}</p>}
      {!logOnly && categorySlug === "etching" && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t("etchHintTextDetailed")}</p>
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
                  {t("delete")}
                </button>
              </div>
              {logOnly ? (
                <textarea
                  defaultValue={e.sourceExcerpt}
                  onBlur={(ev) => {
                    if (ev.target.value !== e.sourceExcerpt) updateEntry(e.id, { sourceExcerpt: ev.target.value });
                  }}
                  placeholder={t("dateLogNotePlaceholder")}
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
                        alert(t("invalidJsonAlert"));
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
      {busy && <p className="text-xs opacity-50">{t("saving")}</p>}
    </div>
  );
}
