import {
  GitHubAuthError,
  GitHubNotFoundError,
  GitHubRateLimitError,
} from "./github_client.js";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface CommitSummary {
  sha: string;
  message: string;
  date: string;
  author: string;
}

export interface CommitFilePatch {
  filename: string;
  patch: string | null;
  status: string;
}

export interface CommitDiff {
  sha: string;
  message: string;
  date: string;
  files: CommitFilePatch[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GITHUB_API_BASE = "https://api.github.com";
const MAX_RETRY = 3;
const MAX_PER_PAGE = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildHeaders(token?: string): Record<string, string> {
  const effectiveToken = token ?? process.env["GITHUB_TOKEN"];
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "secureai-mcp/1.0",
  };
  if (effectiveToken) {
    headers["Authorization"] = `Bearer ${effectiveToken}`;
    // token은 로그에 절대 출력 금지
  }
  return headers;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const response = await fetch(url, { headers });

    const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
    if (response.status === 429 || rateLimitRemaining === "0") {
      const retryAfterHeader = response.headers.get("retry-after");
      const backoffMs = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : Math.pow(2, attempt) * 1000;

      lastError = new GitHubRateLimitError(
        `GitHub rate limit exceeded. Retrying in ${backoffMs / 1000}s (attempt ${attempt + 1}/${MAX_RETRY})`
      );

      if (attempt < MAX_RETRY - 1) {
        await sleep(backoffMs);
        continue;
      }
      throw lastError;
    }

    if (response.status === 403) {
      throw new GitHubAuthError(
        `GitHub API access forbidden: check token permissions or repository access`
      );
    }

    if (response.status === 404) {
      throw new GitHubNotFoundError(`Not found: ${url}`);
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  throw lastError ?? new Error("Unexpected retry loop exit");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * 레포지토리의 커밋 목록을 반환한다.
 * GET /repos/{owner}/{repo}/commits
 */
export async function listCommits(
  owner: string,
  repo: string,
  ref?: string,
  perPage: number = 30,
  token?: string
): Promise<CommitSummary[]> {
  const safePerPage = Math.min(Math.max(1, perPage), MAX_PER_PAGE);

  const url = new URL(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`
  );
  url.searchParams.set("per_page", String(safePerPage));
  if (ref) {
    url.searchParams.set("sha", ref);
  }

  const headers = buildHeaders(token);
  const response = await fetchWithRetry(url.toString(), headers);
  const data = await response.json() as Array<Record<string, unknown>>;

  return data.map((item) => {
    const commitData = item["commit"] as Record<string, unknown> | undefined;
    const authorData = commitData?.["author"] as Record<string, unknown> | undefined;
    const authorInfo = item["author"] as Record<string, unknown> | null | undefined;
    return {
      sha:     (item["sha"] as string) ?? "",
      message: ((commitData?.["message"] as string) ?? "").split("\n")[0],
      date:    (authorData?.["date"] as string) ?? "",
      author:  (authorInfo?.["login"] as string) ?? (authorData?.["name"] as string) ?? "unknown",
    };
  });
}

/**
 * 특정 커밋의 diff(파일별 patch)를 반환한다.
 * GET /repos/{owner}/{repo}/commits/{sha}
 */
export async function getCommitDiff(
  owner: string,
  repo: string,
  sha: string,
  token?: string
): Promise<CommitDiff> {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`;

  const headers = buildHeaders(token);
  const response = await fetchWithRetry(url, headers);
  const data = await response.json() as Record<string, unknown>;

  const commitData = data["commit"] as Record<string, unknown> | undefined;
  const authorData = commitData?.["author"] as Record<string, unknown> | undefined;
  const filesData = (data["files"] as Array<Record<string, unknown>>) ?? [];

  const files: CommitFilePatch[] = filesData.map((f) => ({
    filename: (f["filename"] as string) ?? "",
    patch:    (f["patch"] as string | null) ?? null,
    status:   (f["status"] as string) ?? "",
  }));

  return {
    sha,
    message: ((commitData?.["message"] as string) ?? "").split("\n")[0],
    date:    (authorData?.["date"] as string) ?? "",
    files,
  };
}
