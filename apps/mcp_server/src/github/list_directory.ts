import {
  getContents,
  GitHubFileContent,
  GitHubAuthError,
  GitHubNotFoundError,
  GitHubRateLimitError,
} from "./github_client.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_RECURSIVE_DEPTH = 3;

// ─── Tool Definition ─────────────────────────────────────────────────────────

export const listDirectoryToolDef = {
  name: "github_list_directory",
  description: "List files and directories at a path in a GitHub repository",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      path: {
        type: "string",
        description: "Directory path (default: root '')",
      },
      ref: {
        type: "string",
        description: "Branch/tag/commit (optional)",
      },
      token: {
        type: "string",
        description: "GitHub personal access token (optional)",
      },
      recursive: {
        type: "boolean",
        description: "Recursively list subdirectories (default: false)",
      },
    },
    required: ["owner", "repo"],
  },
} as const;

// ─── Input Type ──────────────────────────────────────────────────────────────

interface ListDirectoryArgs {
  owner: string;
  repo: string;
  path?: string;
  ref?: string;
  token?: string;
  recursive?: boolean;
}

// ─── Tool Handler ────────────────────────────────────────────────────────────

export async function handleListDirectory(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const {
    owner,
    repo,
    path: dirPath = "",
    ref,
    token,
    recursive = false,
  } = args as unknown as ListDirectoryArgs;

  try {
    const result = await getContents(owner, repo, dirPath, ref, token);

    // Single file response — guide the caller to use the correct tool
    if (!Array.isArray(result)) {
      return {
        content: [
          {
            type: "text",
            text: "path is a file, use github_get_file_content instead",
          },
        ],
        isError: true,
      };
    }

    const entries = await buildEntries(
      result,
      owner,
      repo,
      ref,
      token,
      recursive,
      1
    );

    return { content: [{ type: "text", text: entries.join("\n") }] };
  } catch (err) {
    return buildErrorResponse(err);
  }
}

// ─── Recursive Listing ───────────────────────────────────────────────────────

async function buildEntries(
  items: GitHubFileContent[],
  owner: string,
  repo: string,
  ref: string | undefined,
  token: string | undefined,
  recursive: boolean,
  currentDepth: number
): Promise<string[]> {
  const entries: string[] = [];

  for (const item of items) {
    if (item.type === "dir") {
      // Always include directory entries (no binary check needed)
      entries.push(`${item.path}/`);

      if (recursive && currentDepth < MAX_RECURSIVE_DEPTH) {
        try {
          const subResult = await getContents(owner, repo, item.path, ref, token);
          if (Array.isArray(subResult)) {
            const subEntries = await buildEntries(
              subResult,
              owner,
              repo,
              ref,
              token,
              recursive,
              currentDepth + 1
            );
            entries.push(...subEntries);
          }
        } catch {
          // If a subdirectory fails to list, skip it and continue
          entries.push(`  [error listing ${item.path}/]`);
        }
      }
    } else {
      // Include all file entries in the listing (binary check is for content, not listing)
      entries.push(item.path);
    }
  }

  return entries;
}

// ─── Shared Error Builder ────────────────────────────────────────────────────

function buildErrorResponse(
  err: unknown
): { content: Array<{ type: "text"; text: string }>; isError: true } {
  if (
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
