/** Agente: pipeline match → Excel + dual-write Mongo tracker (B-38-5). */
import { runPipelineWithTrackerDualWrite } from "../../src/campaign/pipeline-with-tracker.js";

runPipelineWithTrackerDualWrite().catch((err) => {
  console.error(err);
  process.exit(1);
});
