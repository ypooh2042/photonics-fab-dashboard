import { NextResponse } from "next/server";
import { listRecipeEvents, createRecipeEvent } from "@/lib/admin-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categorySlug = searchParams.get("category");
  const recipeName = searchParams.get("recipeName");
  if (!categorySlug || !recipeName) {
    return NextResponse.json({ error: "category and recipeName required" }, { status: 400 });
  }
  return NextResponse.json(listRecipeEvents(categorySlug, recipeName));
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    categorySlug: string;
    recipeName: string;
    eventDate: string;
    label: string;
  };
  if (!body.categorySlug || !body.recipeName || !body.eventDate?.trim() || !body.label?.trim()) {
    return NextResponse.json({ error: "categorySlug, recipeName, eventDate, label required" }, { status: 400 });
  }
  try {
    createRecipeEvent(body.categorySlug, body.recipeName, body.eventDate.trim(), body.label.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
