import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { NoteExtraction, KnownChipRun, KnownProject, KnownRecipe } from "./types.js";
import { FEW_SHOT_EXAMPLES } from "./prompts/few-shot-examples.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function buildSystemPrompt(): string {
  const base = fs.readFileSync(path.join(__dirname, "prompts", "system-prompt.md"), "utf-8");
  const examples = FEW_SHOT_EXAMPLES.map(
    (ex, i) => `### Example ${i + 1}: ${ex.noteFilename}

Known chip runs (across all projects): ${ex.knownChipRuns}

Note content:
\`\`\`
${ex.noteContent}
\`\`\`

Ideal output JSON:
\`\`\`json
${JSON.stringify(ex.idealOutput, null, 2)}
\`\`\``,
  ).join("\n\n---\n\n");

  return `${base}\n\n## Worked examples (real notes from this vault)\n\n${examples}`;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

interface ClaudeCliResult {
  is_error: boolean;
  subtype: string;
  result: string;
}

/**
 * Strip Anthropic auth env vars so `claude` always falls back to its own stored
 * OAuth/subscription login (~/.claude/.credentials.json) instead of a (possibly
 * unfunded) API key that happens to be set in this process's environment.
 */
function subprocessEnv(): NodeJS.ProcessEnv {
  const { ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_PROFILE, ...rest } = process.env;
  return rest;
}

async function runClaudeCli(systemPrompt: string, userPrompt: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "claude",
    [
      "-p",
      userPrompt,
      "--system-prompt",
      systemPrompt,
      "--output-format",
      "json",
      "--model",
      "sonnet",
      "--allowedTools",
      "",
      "--setting-sources",
      "",
    ],
    {
      cwd: os.tmpdir(),
      env: subprocessEnv(),
      maxBuffer: 1024 * 1024 * 16,
      timeout: 300_000,
    },
  );
  const parsed = JSON.parse(stdout) as ClaudeCliResult;
  if (parsed.is_error || parsed.subtype !== "success") {
    throw new Error(`claude -p returned an error (subtype=${parsed.subtype}): ${parsed.result}`);
  }
  return parsed.result;
}

export interface ExtractInput {
  noteContent: string;
  knownProjects: KnownProject[];
  knownChipRuns: KnownChipRun[];
  knownRecipes?: KnownRecipe[];
}

export async function extractNote({
  noteContent,
  knownProjects,
  knownChipRuns,
  knownRecipes = [],
}: ExtractInput): Promise<NoteExtraction> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = `Known projects (the only valid project_slug values, plus null): ${JSON.stringify(knownProjects)}

Known chip runs (across all projects): ${
    knownChipRuns.length === 0
      ? "[] (none recorded yet)"
      : JSON.stringify(
          knownChipRuns.map((c) => ({
            projectSlug: c.projectSlug,
            projectName: c.projectName,
            label: c.label,
            aliases: c.aliases,
          })),
        )
  }

Known existing recipes (reuse the exact recipe_name from this list whenever a note matches one — see "Reusing known recipe names" in the system prompt; entryMode "log_only" pairs also follow the "Log-only recipes" rules): ${
    knownRecipes.length === 0 ? "[] (none recorded yet)" : JSON.stringify(knownRecipes)
  }

Note content:
\`\`\`
${noteContent}
\`\`\``;

  const rawResult = await runClaudeCli(systemPrompt, userPrompt);
  const jsonText = stripCodeFences(rawResult);
  try {
    return JSON.parse(jsonText) as NoteExtraction;
  } catch (err) {
    throw new Error(
      `Failed to parse extraction JSON: ${(err as Error).message}\nRaw output:\n${rawResult}`,
    );
  }
}
