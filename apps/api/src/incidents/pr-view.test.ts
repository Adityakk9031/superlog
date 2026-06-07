import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildIncidentPullRequestViews } from "./pr-view.js";

test("incident PR view includes the recorded PR patch from its agent run", () => {
  const now = new Date("2026-06-06T12:00:00.000Z");
  const views = buildIncidentPullRequestViews(
    [
      {
        id: "pr-1",
        agentRunId: "run-1",
        repoFullName: "acme/app",
        prNumber: 42,
        url: "https://github.com/acme/app/pull/42",
        branchName: "ash/fix-checkout",
        baseBranch: "main",
        headSha: "abc123",
        state: "open",
        title: "Fix checkout",
        createdAt: now,
        updatedAt: now,
        mergedAt: null,
        closedAt: null,
      },
    ],
    [
      {
        id: "run-1",
        result: {
          state: "complete",
          summary: "Fixed it",
          pr: {
            selectedRepoFullName: "acme/app",
            branchName: "ash/fix-checkout",
            baseBranch: "main",
            validationPassed: true,
            openStatus: "opened",
            patch: "diff --git a/app.ts b/app.ts\n+ok\n",
          },
        },
      },
    ],
  );

  assert.equal(views.length, 1);
  assert.equal(views[0]?.repoFullName, "acme/app");
  assert.equal(views[0]?.patch, "diff --git a/app.ts b/app.ts\n+ok\n");
  assert.equal(views[0]?.createdAt, "2026-06-06T12:00:00.000Z");
});

test("incident PR view returns null patch when the agent run has no patch body", () => {
  const now = new Date("2026-06-06T12:00:00.000Z");
  const views = buildIncidentPullRequestViews(
    [
      {
        id: "pr-1",
        agentRunId: "run-1",
        repoFullName: "acme/app",
        prNumber: 42,
        url: "https://github.com/acme/app/pull/42",
        branchName: "ash/fix-checkout",
        baseBranch: "main",
        headSha: null,
        state: "open",
        title: null,
        createdAt: now,
        updatedAt: now,
        mergedAt: null,
        closedAt: null,
      },
    ],
    [{ id: "run-1", result: { state: "complete", summary: "Fixed it", pr: null } }],
  );

  assert.equal(views[0]?.patch, null);
});
