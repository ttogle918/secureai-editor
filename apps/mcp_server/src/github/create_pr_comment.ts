/**
 * GitHub PR 코멘트 생성 MCP 툴.
 *
 * POST /repos/{owner}/{repo}/issues/{prNumber}/comments
 * token은 절대 console.log로 출력하지 않는다.
 */

const GITHUB_API_BASE = "https://api.github.com";

export interface PrCommentResult {
  id: number;
  html_url: string;
}

/**
 * GitHub PR에 코멘트를 작성한다.
 *
 * @param owner    레포지토리 소유자
 * @param repo     레포지토리 이름
 * @param prNumber PR 번호
 * @param body     코멘트 본문 (Markdown 지원)
 * @param token    GitHub Personal Access Token (로그 출력 금지)
 * @returns        생성된 코멘트 ID와 URL
 */
export async function createPrComment(
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
  token: string
): Promise<PrCommentResult> {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${prNumber}/comments`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "secureai-mcp/1.0",
    },
    body: JSON.stringify({ body }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(`GitHub API access forbidden: check token permissions`);
  }

  if (response.status === 404) {
    throw new Error(`Not found: ${owner}/${repo}#${prNumber}`);
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { id: number; html_url: string };
  return { id: data.id, html_url: data.html_url };
}

// ─── MCP Tool Definition ─────────────────────────────────────────────────────

export const createPrCommentToolDef = {
  name: "github_create_pr_comment",
  description: "Create a comment on a GitHub pull request",
  inputSchema: {
    type: "object" as const,
    properties: {
      owner: {
        type: "string",
        description: "Repository owner (user or organization login)",
      },
      repo: {
        type: "string",
        description: "Repository name",
      },
      prNumber: {
        type: "number",
        description: "Pull request number",
      },
      body: {
        type: "string",
        description: "Comment body (Markdown supported)",
      },
      token: {
        type: "string",
        description: "GitHub Personal Access Token with repo scope",
      },
    },
    required: ["owner", "repo", "prNumber", "body", "token"],
  },
};

// ─── MCP Tool Handler ─────────────────────────────────────────────────────────

/**
 * MCP CallTool 핸들러.
 * args를 zod 없이 수동 검증하고 createPrComment를 호출한다.
 */
export async function handleCreatePrComment(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const owner = args["owner"];
  const repo = args["repo"];
  const prNumber = args["prNumber"];
  const body = args["body"];
  const token = args["token"];

  if (
    typeof owner !== "string" || owner.trim() === "" ||
    typeof repo !== "string" || repo.trim() === "" ||
    typeof prNumber !== "number" || !Number.isInteger(prNumber) || prNumber <= 0 ||
    typeof body !== "string" || body.trim() === "" ||
    typeof token !== "string" || token.trim() === ""
  ) {
    return {
      content: [
        {
          type: "text",
          text: "Invalid arguments: owner, repo (string), prNumber (positive integer), body, token are required",
        },
      ],
    };
  }

  try {
    const result = await createPrComment(owner, repo, prNumber, body, token);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ id: result.id, html_url: result.html_url }, null, 2),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // token은 절대 에러 메시지에 포함하지 않음
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
    };
  }
}
