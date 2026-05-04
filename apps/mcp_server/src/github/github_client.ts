import path from "node:path";
import { BINARY_EXTENSIONS, FileFilterError } from "../file_filter.js";

// Re-export so callers can import from a single location
export { FileFilterError } from "../file_filter.js";

// ─── Custom Error Classes ────────────────────────────────────────────────────

export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubAuthError";
  }
}

export class GitHubNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubNotFoundError";
  }
}

export class GitHubRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubRateLimitError";
  }
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;       // bytes
  type: "file" | "dir" | "symlink" | "submodule";
  content?: string;   // base64 encoded, only for type="file"
  encoding?: string;  // "base64"
  download_url: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GITHUB_API_BASE = "https://api.github.com";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_RETRY = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildHeaders(token?: string): Record<string, string> {
  const effectiveToken = token ?? process.env["GITHUB_TOKEN"];
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "secureai-mcp/1.0",
  };
  if (effectiveToken) {
    headers["Authorization"] = `Bearer ${effectiveToken}`;
  }
  return headers;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertNotBinaryOrOversized(item: GitHubFileContent): void {
  // Skip check for directories
  if (item.type !== "file") return;

  if (item.size > MAX_FILE_BYTES) {
    throw new FileFilterError(
      `File too large: ${(item.size / 1024 / 1024).toFixed(1)} MB (max 10 MB)`
    );
  }

  const ext = path.extname(item.name).toLowerCase();
  if (ext && BINARY_EXTENSIONS.has(ext)) {
    throw new FileFilterError(`Binary file type not allowed: ${ext}`);
  }
}

// ─── Core API Function ───────────────────────────────────────────────────────

/**
 * Fetch contents of a file or directory from GitHub REST API.
 * Returns a single GitHubFileContent for a file or an array for a directory.
 *
 * Retries on rate-limit responses with exponential backoff (up to MAX_RETRY times).
 */
export async function getContents(
  owner: string,
  repo: string,
  filePath: string,
  ref?: string,
  token?: string
): Promise<GitHubFileContent | GitHubFileContent[]> {
  // Reject path traversal attempts
  if (filePath.includes("..")) {
    throw new Error(`Path traversal detected in GitHub path: ${filePath}`);
  }

  const encodedPath = filePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(encodeURIComponent)
    .join("/");

  const url = new URL(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`
  );
  if (ref) {
    url.searchParams.set("ref", ref);
  }

  const headers = buildHeaders(token);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const response = await fetch(url.toString(), { headers });

    // Handle rate limit: 429 or x-ratelimit-remaining=0
    const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
    if (response.status === 429 || rateLimitRemaining === "0") {
      const retryAfterHeader = response.headers.get("retry-after");
      const backoffMs = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : Math.pow(2, attempt) * 1000; // 1s → 2s → 4s

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
      throw new GitHubNotFoundError(
        `Not found: ${owner}/${repo}/${filePath}`
      );
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubFileContent | GitHubFileContent[];

    // Apply binary/size filter for single file results
    if (!Array.isArray(data)) {
      assertNotBinaryOrOversized(data);
    }

    return data;
  }

  throw lastError ?? new Error("Unexpected retry loop exit");
}
