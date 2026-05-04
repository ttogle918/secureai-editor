import {
  getContents,
  FileFilterError,
  GitHubAuthError,
  GitHubNotFoundError,
  GitHubRateLimitError,
} from "./github_client.js";

// ─── Tool Definition ─────────────────────────────────────────────────────────

export const getFileContentToolDef = {
  name: "github_get_file_content",
  description: "Get the content of a file from a GitHub repository",
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
      path: {
        type: "string",
        description: "File path within the repository",
      },
      ref: {
        type: "string",
        description: "Branch, tag, or commit SHA (optional)",
      },
      token: {
        type: "string",
        description: "GitHub personal access token (optional)",
      },
    },
    required: ["owner", "repo", "path"],
  },
} as const;

// ─── Input Type ──────────────────────────────────────────────────────────────

interface GetFileContentArgs {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
  token?: string;
}

// ─── Tool Handler ────────────────────────────────────────────────────────────

export async function handleGetFileContent(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const { owner, repo, path: filePath, ref, token } = args as GetFileContentArgs;

  try {
    const result = await getContents(owner, repo, filePath, ref, token);

    // Directory response — guide the caller to use the correct tool
    if (Array.isArray(result)) {
      return {
        content: [
          {
            type: "text",
            text: "path is a directory, use github_list_directory instead",
          },
        ],
        isError: true,
      };
    }

    // Non-file type (symlink, submodule)
    if (result.type !== "file") {
      return {
        content: [
          {
            type: "text",
            text: `Cannot read content: path is of type '${result.type}'`,
          },
        ],
        isError: true,
      };
    }

    // Decode base64 content
    const base64Content = result.content ?? "";
    // GitHub returns base64 with newlines — strip them before decoding
    const cleaned = base64Content.replace(/\n/g, "");
    const decoded = Buffer.from(cleaned, "base64").toString("utf-8");

    return { content: [{ type: "text", text: decoded }] };
  } catch (err) {
    return buildErrorResponse(err);
  }
}

// ─── Shared Error Builder ────────────────────────────────────────────────────

function buildErrorResponse(
  err: unknown
): { content: Array<{ type: "text"; text: string }>; isError: true } {
  if (
    err instanceof FileFilterError ||
    err instanceof GitHubAuthError ||
    err instanceof GitHubNotFoundError ||
    err instanceof GitHubRateLimitError ||
    err instanceof Error
  ) {
    return { content: [{ type: "text", text: err.message }], isError: true };
  }
  return {
    content: [{ type: "text", text: "An unexpected error occurred" }],
    isError: true,
  };
}
