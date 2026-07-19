/** Agente: Gmail reconcile (labels desde Excel) — delega a qa-job-applied-list. */
import { runAppliedListScript } from "../../src/campaign/applied-list.js";

runAppliedListScript("gmail:reconcile");
