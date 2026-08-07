import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeEntries, getRecipeDescription, getRecipeEntryMode, listRecipeCategories, recipeExists } from "@/lib/data";
import RecipeAdminEditor from "@/components/RecipeAdminEditor";

export default async function AdminRecipeEditPage({
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

  return (
    <div className="max-w-2xl">
      <Link href={`/admin/recipes/${category}`} className="text-sm opacity-60 hover:opacity-100">
        ← {categoryInfo.name}
      </Link>
      <h1 className="text-xl font-semibold mt-2 mb-4">{decodedName} 수정</h1>
      <RecipeAdminEditor
        categorySlug={category}
        recipeName={decodedName}
        entries={entries}
        description={description}
        entryMode={entryMode}
      />
    </div>
  );
}
