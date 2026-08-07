import Link from "next/link";
import { notFound } from "next/navigation";
import { listRecipesInCategory, listRecipeCategories } from "@/lib/data";
import CreateRecipeForm from "@/components/CreateRecipeForm";

export default async function AdminRecipeListPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const categoryInfo = listRecipeCategories().find((c) => c.slug === category);
  if (!categoryInfo) notFound();
  const recipes = listRecipesInCategory(category);

  return (
    <div className="max-w-lg">
      <Link href="/admin/recipes" className="text-sm opacity-60 hover:opacity-100">
        ← 카테고리 목록
      </Link>
      <h1 className="text-xl font-semibold mt-2 mb-4">{categoryInfo.name}</h1>
      <div className="flex flex-col gap-2">
        {recipes.map((r) => (
          <Link
            key={r.recipeName}
            href={`/admin/recipes/${category}/${encodeURIComponent(r.recipeName)}/edit`}
            className="flex items-center justify-between rounded-md border border-black/10 dark:border-white/15 px-3 py-2 text-sm hover:border-amber-500"
          >
            <span>{r.recipeName}</span>
            <span className="opacity-50">기록 {r.entryCount}건</span>
          </Link>
        ))}
      </div>
      <div className="mt-4">
        <CreateRecipeForm categorySlug={category} />
      </div>
    </div>
  );
}
