import type { NoteExtraction } from "../types.js";

export interface FewShotExample {
  noteFilename: string;
  knownChipRuns: string; // pre-formatted for prompt injection
  noteContent: string;
  idealOutput: NoteExtraction;
}

// Copy this file to few-shot-examples.ts (gitignored — kept local since real
// examples necessarily contain real lab-notebook content: device names,
// experimental conditions, photo filenames, collaborator names) and replace
// the entries below with a handful of your own real notes paired with the
// extraction you'd want the LLM to produce for them. This is the
// highest-leverage lever for extraction quality on freeform historical
// notes — aim for examples that each teach a distinct pattern (e.g. a new
// chip run, a recipe-only note with no chip run, matching an EXISTING chip
// run via cross-link, one note spanning multiple projects/chip runs).
export const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    noteFilename: "2026-01-15 example e-beam exposure note.md",
    knownChipRuns: "[]  (no chip runs recorded yet in any project)",
    noteContent: `- Fab facility에 가서 e-beam 노광 진행함.
- Example pattern layout을 준비해서 1차 노광 진행.
- E-beam exposure 조건은 기존과 동일 (표준 조건)
	- 장비: (여기에 실제 장비명)
	- Dose 240uC/cm^2, 2nA

## Develop pattern

전체 layout:
![[example_layout.jpg]]`,
    idealOutput: {
      chip_runs: [
        {
          project_slug: "project-a",
          is_new: true,
          match_hint: "0115_example_run",
          label: "0115_example_run",
          confidence: 0.9,
          stages: [
            {
              stage_type: "e_beam_lithography",
              status: "complete",
              blocked_reason: null,
              note: "Example pattern 1차 노광, 표준 조건으로 진행",
              photos: [],
            },
            {
              stage_type: "development",
              status: "complete",
              blocked_reason: null,
              note: "develop까지 진행",
              photos: [{ filename: "example_layout.jpg", caption: "전체 layout" }],
            },
          ],
        },
      ],
      recipe_entries: [],
    },
  },
];
