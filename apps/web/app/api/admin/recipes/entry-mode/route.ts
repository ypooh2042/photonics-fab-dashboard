import { NextResponse } from "next/server";
import { updateRecipeEntryMode } from "@/lib/admin-data";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    categorySlug: string;
    recipeName: string;
    entryMode: string;
  };
  if (!body.categorySlug || !body.recipeName) {
    return NextResponse.json({ error: "categorySlug and recipeName required" }, { status: 400 });
  }
  if (body.entryMode !== "full" && body.entryMode !== "log_only") {
    return NextResponse.json({ error: "entryMode must be 'full' or 'log_only'" }, { status: 400 });
  }
  try {
    updateRecipeEntryMode(body.categorySlug, body.recipeName, body.entryMode);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
