import { NextResponse } from "next/server";
import { listProjects, createProject } from "@/lib/admin-data";

export async function GET() {
  return NextResponse.json(listProjects());
}

export async function POST(request: Request) {
  const body = (await request.json()) as { slug: string; name: string };
  if (!body.slug?.trim() || !body.name?.trim()) {
    return NextResponse.json({ error: "slug and name are required" }, { status: 400 });
  }
  try {
    const id = createProject(body.slug.trim(), body.name.trim());
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
