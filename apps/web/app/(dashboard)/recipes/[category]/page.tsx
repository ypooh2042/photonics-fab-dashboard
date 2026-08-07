import Link from "next/link";
import { listRecipesInCategory, listRecipeCategories } from "@/lib/data";
import { notFound } from "next/navigation";

export default async function RecipeListPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const categoryInfo = listRecipeCategories().find((c) => c.slug === category);
  if (!categoryInfo) notFound();
  const recipes = listRecipesInCategory(category);

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link href="/recipes" className="text-sm opacity-60 hover:opacity-100">
          ← 카테고리 목록
        </Link>
        <Link href={`/admin/recipes/${category}`} className="text-sm opacity-60 hover:opacity-100">
          관리자 수정
        </Link>
      </div>
      <h1 className="text-xl font-semibold mt-2 mb-4">{categoryInfo.name}</h1>
      {recipes.length === 0 ? (
        <p className="opacity-60">아직 기록된 레시피가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {recipes.map((r) => (
            <Link
              key={r.recipeName}
              href={`/recipes/${category}/${encodeURIComponent(r.recipeName)}`}
              className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/15 px-4 py-3 hover:border-blue-500 transition-colors"
            >
              <span className="font-medium">{r.recipeName}</span>
              <span className="text-xs opacity-60">
                기록 {r.entryCount}건 · 최근 {r.lastEntryDate}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
