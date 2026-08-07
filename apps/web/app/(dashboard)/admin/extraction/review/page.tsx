import Link from "next/link";
import { listNeedsReviewChipRuns, listNeedsReviewRecipeEntries } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function AdminExtractionReviewPage() {
  const chipRuns = listNeedsReviewChipRuns();
  const recipeEntries = listNeedsReviewRecipeEntries();

  return (
    <div className="max-w-3xl flex flex-col gap-8">
      <h1 className="text-xl font-semibold">자동추출 검수</h1>
      <div>
        <h2 className="font-medium mb-2">검수 필요 칩 런 ({chipRuns.length})</h2>
        {chipRuns.length === 0 ? (
          <p className="text-sm opacity-60">없음</p>
        ) : (
          <div className="flex flex-col gap-1">
            {chipRuns.map((c) => (
              <Link
                key={c.id}
                href={`/admin/chips/${c.id}/edit`}
                className="flex items-center justify-between text-sm rounded-md border border-black/10 dark:border-white/15 px-3 py-2 hover:border-amber-500"
              >
                <span>
                  {c.projectName} · {c.label}
                </span>
                <span className="opacity-60">
                  confidence {c.llmConfidence != null ? c.llmConfidence.toFixed(2) : "-"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-medium mb-2">검수 필요 레시피 항목 ({recipeEntries.length})</h2>
        {recipeEntries.length === 0 ? (
          <p className="text-sm opacity-60">없음</p>
        ) : (
          <div className="flex flex-col gap-1">
            {recipeEntries.map((r) => (
              <div
                key={r.id}
                className="text-sm rounded-md border border-black/10 dark:border-white/15 px-3 py-2"
              >
                <p>
                  {r.categoryName} · {r.recipeName} · {r.entryDate}
                </p>
                <p className="opacity-60 text-xs mt-1">{r.sourceExcerpt}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
