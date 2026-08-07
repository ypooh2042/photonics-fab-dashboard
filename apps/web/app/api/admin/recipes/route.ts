import { NextResponse } from "next/server";
import { listRecipesInCategory } from "@/lib/data";
import { deleteRecipe, createRecipe } from "@/lib/admin-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  if (!category) return NextResponse.json({ error: "category required" }, { status: 400 });
  return NextResponse.json(listRecipesInCategory(category));
}

export async function POST(request: Request) {
  const body = (await request.json()) as { categorySlug: string; recipeName: string; description?: string };
  if (!body.categorySlug || !body.recipeName?.trim()) {
    return NextResponse.json({ error: "categorySlug and recipeName required" }, { status: 400 });
  }
  try {
    createRecipe(body.categorySlug, body.recipeName.trim(), body.description?.trim() || null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const recipeName = searchParams.get("recipeName");
  if (!category || !recipeName) {
    return NextResponse.json({ error: "category and recipeName required" }, { status: 400 });
  }
  try {
    const count = deleteRecipe(category, recipeName);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
