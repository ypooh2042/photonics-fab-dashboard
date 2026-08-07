import Link from "next/link";
import { listRecipeCategories } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminRecipeCategoriesPage() {
  const categories = listRecipeCategories();
  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-4">레시피 위키 관리</h1>
      <div className="flex flex-col gap-2">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/admin/recipes/${c.slug}`}
            className="flex items-center justify-between rounded-md border border-black/10 dark:border-white/15 px-3 py-2 text-sm hover:border-amber-500"
          >
            <span>{c.name}</span>
            <span className="opacity-50">
              레시피 {c.recipeCount}개 · 기록 {c.entryCount}건
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
