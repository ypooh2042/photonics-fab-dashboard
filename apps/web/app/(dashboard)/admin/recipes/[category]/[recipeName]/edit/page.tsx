import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeEntries, getRecipeDescription, getRecipeEntryMode, listRecipeCategories, recipeExists } from "@/lib/data";
import RecipeAdminEditor from "@/components/RecipeAdminEditor";
import { getServerLang } from "@/lib/i18n-server";

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
  const lang = await getServerLang();

  return (
    <div className="max-w-2xl">
      <Link href={`/admin/recipes/${category}`} className="text-sm opacity-60 hover:opacity-100">
        ← {categoryInfo.name}
      </Link>
      <h1 className="text-xl font-semibold mt-2 mb-4">{lang === "ko" ? `${decodedName} 수정` : `Edit ${decodedName}`}</h1>
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
