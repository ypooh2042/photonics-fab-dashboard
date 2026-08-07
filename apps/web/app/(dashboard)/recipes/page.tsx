import Link from "next/link";
import { listRecipeCategories } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RecipeCategoriesPage() {
  const categories = listRecipeCategories();

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">레시피 위키</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/recipes/${c.slug}`}
            className="block rounded-lg border border-black/10 dark:border-white/15 p-4 hover:border-blue-500 transition-colors"
          >
            <h3 className="font-medium">{c.name}</h3>
            <p className="text-xs opacity-60 mt-1">
              레시피 {c.recipeCount}개 · 기록 {c.entryCount}건
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
