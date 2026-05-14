import {
  listCommits,
  getCommitDiff,
  CommitSummary,
  CommitDiff,
} from "./commit_history_client.js";
import {
  GitHubAuthError,
  GitHubNotFoundError,
  GitHubRateLimitError,
} from "./github_client.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const listCommitsToolDef = {
  name: "github_list_commits",
  description: "List recent commits for a GitHub repository",
  inputSchema: {
    type: "object",
    properties: {
      owner: {
        type: "string",
        description: "GitHub repository owner (user or org)",
      },
      repo: {
        type: "string",
        description: "Repository name",
      },
      ref: {
        type: "string",
        description: "Branch, tag, or commit SHA to start from (optional)",
      },
      per_page: {
        type: "number",
        description: "Number of commits to return (1-100, default: 30)",
      },
      token: {
        type: "string",
        description: "GitHub personal access token (optional)",
      },
    },
    required: ["owner", "repo"],
  },
} as const;

export const getCommitDiffToolDef = {
  name: "github_get_commit_diff",
  description: "Get the file-level diffs (patches) for a specific commit",
  inputSchema: {
    type: "object",
    properties: {
      owner: {
        type: "string",
        description: "GitHub repository owner (user or org)",
      },
      repo: {
        type: "string",
        description: "Repository name",
      },
      sha: {
        type: "string",
        description: "Commit SHA",
      },
      token: {
        type: "string",
        description: "GitHub personal access token (optional)",
      },
    },
    required: ["owner", "repo", "sha"],
  },
} as const;

// ─── Input Types ─────────────────────────────────────────────────────────────

interface ListCommitsArgs {
  owner: string;
  repo: string;
  ref?: string;
  per_page?: number;
  token?: string;
}

interface GetCommitDiffArgs {
  owner: string;
  repo: string;
  sha: string;
  token?: string;
}

type ToolResponse = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

// ─── Tool Handlers ────────────────────────────────────────────────────────────

export async function handleListCommits(args: Record<string, unknown>): Promise<ToolResponse> {
  const { owner, repo, ref, per_page, token } = args as unknown as ListCommitsArgs;

  try {
    const commits: CommitSummary[] = await listCommits(owner, repo, ref, per_page ?? 30, token);
    return { content: [{ type: "text", text: JSON.stringify(commits, null, 2) }] };
  } catch (err) {
    return buildErrorResponse(err);
  }
}

export async function handleGetCommitDiff(args: Record<string, unknown>): Promise<ToolResponse> {
  const { owner, repo, sha, token } = args as unknown as GetCommitDiffArgs;

  try {
    const diff: CommitDiff = await getCommitDiff(owner, repo, sha, token);
    return { content: [{ type: "text", text: JSON.stringify(diff, null, 2) }] };
  } catch (err) {
    return buildErrorResponse(err);
  }
}

// ─── Shared Error Builder ─────────────────────────────────────────────────────

function buildErrorResponse(err: unknown): { content: Array<{ type: "text"; text: string }>; isError: true } {
  if (
    err instanceof GitHubAuthError ||
    err instanceof GitHubNotFoundError ||
    err instanceof GitHubRateLimitError ||
    err instanceof Error
  ) {
    return { content: [{ type: "text", text: err.message }], isError: true };
  }
  return { content: [{ type: "text", text: "An unexpected error occurred" }], isError: true };
}
