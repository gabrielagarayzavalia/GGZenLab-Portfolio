import { runAppliedListScript } from "./applied-list.js";
import { syncPipelineMatchesToTracker } from "../tracker/sync-pipeline-matches.js";

/** run-pipeline (applied-list) + dual-write opcional a Mongo applications. */
export async function runPipelineWithTrackerDualWrite(): Promise<void> {
  runAppliedListScript("run-pipeline");
  await syncPipelineMatchesToTracker();
}
