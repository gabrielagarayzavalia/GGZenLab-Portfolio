import { runAppliedListScript } from "./applied-list.js";
import { syncPipelineToTracker } from "../tracker/pipeline-sync.js";
import { exportJobsResultFromPipeline } from "../tracker/export-jobs-result.js";

/** run-pipeline (applied-list) + dual-write opcional a Mongo applications. */
export async function runPipelineWithTrackerDualWrite(): Promise<void> {
  runAppliedListScript("run-pipeline");
  await syncPipelineToTracker();
  exportJobsResultFromPipeline();
}