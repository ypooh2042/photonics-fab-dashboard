import Link from "next/link";
import { listRecipeCategories } from "@/lib/data";
import { getServerLang } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AdminRecipeCategoriesPage() {
  const categories = listRecipeCategories();
  const lang = await getServerLang();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, lang);
  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-4">{t("manageRecipeWikiHeading")}</h1>
      <div className="flex flex-col gap-2">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/admin/recipes/${c.slug}`}
            className="flex items-center justify-between rounded-md border border-black/10 dark:border-white/15 px-3 py-2 text-sm hover:border-amber-500"
          >
            <span>{c.name}</span>
            <span className="opacity-50">
              {lang === "ko"
                ? `${t("recipesLabel")} ${c.recipeCount}개 · ${t("entriesLabel")} ${c.entryCount}건`
                : `${c.recipeCount} ${t("recipesLabel")} · ${c.entryCount} ${t("entriesLabel")}`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
