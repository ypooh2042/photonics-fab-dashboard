import Link from "next/link";
import { listRecipesInCategory, listRecipeCategories } from "@/lib/data";
import { notFound } from "next/navigation";
import { getServerLang } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";

export default async function RecipeListPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const categoryInfo = listRecipeCategories().find((c) => c.slug === category);
  if (!categoryInfo) notFound();
  const recipes = listRecipesInCategory(category);
  const lang = await getServerLang();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, lang);

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link href="/recipes" className="text-sm opacity-60 hover:opacity-100">
          ← {t("categoryListBack")}
        </Link>
        <Link href={`/admin/recipes/${category}`} className="text-sm opacity-60 hover:opacity-100">
          {t("adminEditLink")}
        </Link>
      </div>
      <h1 className="text-xl font-semibold mt-2 mb-4">{categoryInfo.name}</h1>
      {recipes.length === 0 ? (
        <p className="opacity-60">{t("noRecipesYet")}</p>
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
                {lang === "ko"
                  ? `${t("entriesLabel")} ${r.entryCount}건 · ${t("recentLabel")} ${r.lastEntryDate}`
                  : `${r.entryCount} ${t("entriesLabel")} · ${t("recentLabel")} ${r.lastEntryDate}`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
