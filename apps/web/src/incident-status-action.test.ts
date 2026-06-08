import assert from "node:assert/strict";
import test from "node:test";
import { getIncidentStatusAction } from "./incident-status-action.ts";

test("open incidents can be resolved", () => {
  assert.deepEqual(getIncidentStatusAction("open"), {
    label: "Resolve incident",
    targetStatus: "resolved",
    variant: "secondary",
  });
});

test("noise incidents can be reopened", () => {
  assert.deepEqual(getIncidentStatusAction("autoresolved_noise"), {
    label: "Reopen incident",
    targetStatus: "open",
    variant: "ghost",
  });
});
