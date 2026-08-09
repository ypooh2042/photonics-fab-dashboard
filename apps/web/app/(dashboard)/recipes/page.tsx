import Link from "next/link";
import { listRecipeCategories } from "@/lib/data";
import { getServerLang } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function RecipeCategoriesPage() {
  const categories = listRecipeCategories();
  const lang = await getServerLang();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, lang);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">{t("navRecipeWiki")}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/recipes/${c.slug}`}
            className="block rounded-lg border border-black/10 dark:border-white/15 p-4 hover:border-blue-500 transition-colors"
          >
            <h3 className="font-medium">{c.name}</h3>
            <p className="text-xs opacity-60 mt-1">
              {lang === "ko"
                ? `${t("recipesLabel")} ${c.recipeCount}개 · ${t("entriesLabel")} ${c.entryCount}건`
                : `${c.recipeCount} ${t("recipesLabel")} · ${c.entryCount} ${t("entriesLabel")}`}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
