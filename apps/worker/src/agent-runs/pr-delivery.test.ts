import "../agent-run.test-env.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { schema } from "@superlog/db";
import type { AgentRunContext } from "../agent-run-context.js";
import { resolvePullRequestBaseBranch } from "./pr-delivery.js";

test("resolvePullRequestBaseBranch prefers the configured project branch", () => {
  const ctx = { prBaseBranch: "development" } as AgentRunContext;
  const pr = { baseBranch: "main" } as schema.AgentRunPr;

  assert.equal(resolvePullRequestBaseBranch(ctx, pr), "development");
});

test("resolvePullRequestBaseBranch falls back to the agent branch when unset", () => {
  const ctx = { prBaseBranch: null } as AgentRunContext;
  const pr = { baseBranch: "main" } as schema.AgentRunPr;

  assert.equal(resolvePullRequestBaseBranch(ctx, pr), "main");
});

test("resolvePullRequestBaseBranch lets GitHub use the repository default when both are blank", () => {
  const ctx = { prBaseBranch: "   " } as AgentRunContext;
  const pr = { baseBranch: "" } as schema.AgentRunPr;

  assert.equal(resolvePullRequestBaseBranch(ctx, pr), null);
});
