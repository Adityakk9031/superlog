import type { schema } from "@superlog/db";

export type IncidentPullRequestView = {
  id: string;
  agentRunId: string;
  repoFullName: string;
  prNumber: number;
  url: string;
  branchName: string;
  baseBranch: string;
  headSha: string | null;
  state: schema.AgentPrState;
  title: string | null;
  patch: string | null;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
};

type AgentRunWithResult = Pick<schema.AgentRun, "id" | "result">;
type AgentPullRequestRow = Pick<
  schema.AgentPullRequest,
  | "id"
  | "agentRunId"
  | "repoFullName"
  | "prNumber"
  | "url"
  | "branchName"
  | "baseBranch"
  | "headSha"
  | "state"
  | "title"
  | "createdAt"
  | "updatedAt"
  | "mergedAt"
  | "closedAt"
>;

export function buildIncidentPullRequestViews(
  prs: AgentPullRequestRow[],
  agentRuns: AgentRunWithResult[],
): IncidentPullRequestView[] {
  const runsById = new Map(agentRuns.map((run) => [run.id, run] as const));
  return prs.map((pr) => {
    const run = runsById.get(pr.agentRunId) ?? null;
    const runPr = run?.result?.pr ?? null;
    const patch = typeof runPr?.patch === "string" && runPr.patch.trim() ? runPr.patch : null;
    return {
      id: pr.id,
      agentRunId: pr.agentRunId,
      repoFullName: pr.repoFullName,
      prNumber: pr.prNumber,
      url: pr.url,
      branchName: pr.branchName,
      baseBranch: pr.baseBranch,
      headSha: pr.headSha,
      state: pr.state,
      title: pr.title,
      patch,
      createdAt: pr.createdAt.toISOString(),
      updatedAt: pr.updatedAt.toISOString(),
      mergedAt: pr.mergedAt?.toISOString() ?? null,
      closedAt: pr.closedAt?.toISOString() ?? null,
    };
  });
}
