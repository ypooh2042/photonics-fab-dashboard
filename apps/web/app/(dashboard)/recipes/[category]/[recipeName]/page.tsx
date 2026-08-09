import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getRecipeEntries,
  getRecipeDescription,
  getRecipeEntryMode,
  getRecipeEvents,
  listRecipeCategories,
  recipeExists,
} from "@/lib/data";
import RecipeTrendChart from "@/components/RecipeTrendChart";

const TREND_CATEGORIES = new Set(["etching", "deposition"]);

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ category: string; recipeName: string }>;
}) {
  const { category, recipeName } = await params;
  const categoryInfo = listRecipeCategories().find((c) => c.slug === category);
  if (!categoryInfo) notFound();
  const decodedName = decodeURIComponent(recipeName);
  if (!recipeExists(category, decodedName)) notFound();
  const entries = getRecipeEntries(category, decodedName);
  const description = getRecipeDescription(category, decodedName);
  const entryMode = getRecipeEntryMode(category, decodedName);
  const logOnly = entryMode === "log_only";
  const events = TREND_CATEGORIES.has(category) ? getRecipeEvents(category, decodedName) : [];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <Link href={`/recipes/${category}`} className="text-sm opacity-60 hover:opacity-100">
          ← {categoryInfo.name}
        </Link>
        <Link
          href={`/admin/recipes/${category}/${encodeURIComponent(decodedName)}/edit`}
          className="text-sm opacity-60 hover:opacity-100"
        >
          관리자 수정
        </Link>
      </div>
      <h1 className="text-xl font-semibold mt-2 mb-4">{decodedName}</h1>

      {description && (
        <div className="mb-4 rounded-lg border border-black/10 dark:border-white/15 p-4">
          <h3 className="font-medium text-sm mb-2">{logOnly ? "레시피 설명" : "레시피 설명 (고정 조건)"}</h3>
          <p className="text-sm opacity-80 whitespace-pre-wrap">{description}</p>
        </div>
      )}

      {!logOnly && TREND_CATEGORIES.has(category) && entries.length > 0 && (
        <RecipeTrendChart entries={entries} categorySlug={category} events={events} />
      )}

      {entries.length === 0 ? (
        <p className="mt-6 text-sm opacity-60">아직 기록된 사용 이력이 없습니다.</p>
      ) : logOnly ? (
        <div className="mt-6">
          <h3 className="font-medium text-sm mb-2">이용 날짜 로그</h3>
          <div className="flex flex-col gap-1">
            {entries
              .slice()
              .reverse()
              .map((e) => (
                <div key={e.id} className="flex flex-col gap-0.5 text-sm border-b border-black/5 dark:border-white/10 py-1">
                  <span className="font-medium">{e.entryDate}</span>
                  {e.sourceExcerpt && <span className="opacity-60 whitespace-pre-wrap">{e.sourceExcerpt}</span>}
                </div>
              ))}
          </div>
        </div>
      ) : (
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-black/10 dark:border-white/15">
              <th className="py-2 pr-4">날짜</th>
              <th className="py-2 pr-4">파라미터</th>
            </tr>
          </thead>
          <tbody>
            {entries
              .slice()
              .reverse()
              .map((e) => (
                <tr key={e.id} className="border-b border-black/5 dark:border-white/10 align-top">
                  <td className="py-2 pr-4 whitespace-nowrap">{e.entryDate}</td>
                  <td className="py-2 pr-4 opacity-80">
                    {Object.entries(e.params)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
