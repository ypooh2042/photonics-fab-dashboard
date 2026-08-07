import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  const { notePath } = (await request.json()) as { notePath: string };
  const repoRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "../..");
  const scriptPath = path.join(repoRoot, "packages/ingestion/src/reprocess-one.ts");
  const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");

  // DB_PATH in .env.local is relative to apps/web's own cwd — resolve it to an
  // absolute path here before handing it to the child, since the child runs
  // with a different cwd (repo root, so ingestion's own relative script paths
  // and default DB location resolve correctly).
  const absoluteDbPath = path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    process.env.DB_PATH ?? "../../data/fab_dashboard.sqlite",
  );

  try {
    const { stdout } = await execFileAsync(tsxBin, [scriptPath, "--note", notePath], {
      cwd: repoRoot,
      env: { ...process.env, DB_PATH: absoluteDbPath },
      maxBuffer: 1024 * 1024 * 8,
      timeout: 300_000,
    });
    const lastLine = stdout.trim().split("\n").pop() ?? "{}";
    const result = JSON.parse(lastLine);
    return NextResponse.json(result, { status: result.ok === false ? 500 : 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
