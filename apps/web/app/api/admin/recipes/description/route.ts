import { NextResponse } from "next/server";
import { updateRecipeDescription } from "@/lib/admin-data";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    categorySlug: string;
    recipeName: string;
    description: string;
  };
  if (!body.categorySlug || !body.recipeName) {
    return NextResponse.json({ error: "categorySlug and recipeName required" }, { status: 400 });
  }
  try {
    updateRecipeDescription(body.categorySlug, body.recipeName, body.description ?? "");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
