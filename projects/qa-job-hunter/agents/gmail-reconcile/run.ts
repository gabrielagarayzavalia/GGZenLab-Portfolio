/** Agente: Gmail reconcile (labels desde Excel) + dual-write Mongo (B-23-02). */
import { runAppliedListScript } from "../../src/campaign/applied-list.js";
import { syncReconcileToTracker } from "../../src/tracker/reconcile-sync.js";

runAppliedListScript("gmail:reconcile");
await syncReconcileToTracker();
