import { checkAndRunCutover } from "./cutover.js";

const result = checkAndRunCutover();

if (result.ran) {
  console.log(`[cutover] rolled over ${result.fromWeekId} -> ${result.toWeekId}`);
} else {
  console.log("[cutover] no boundary crossed, nothing to do");
}
