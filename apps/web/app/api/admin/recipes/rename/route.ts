import { NextResponse } from "next/server";
import { renameRecipe } from "@/lib/admin-data";

export async function POST(request: Request) {
  const body = (await request.json()) as { categorySlug: string; oldName: string; newName: string };
  if (!body.categorySlug || !body.oldName || !body.newName?.trim()) {
    return NextResponse.json({ error: "categorySlug, oldName, newName required" }, { status: 400 });
  }
  try {
    const count = renameRecipe(body.categorySlug, body.oldName, body.newName.trim());
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
