import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import path from "node:path";

import { validatePath, PathValidationError } from "./path_validator.js";
import { assertReadable, FileFilterError } from "./file_filter.js";
import {
  handleGetFileContent,
  getFileContentToolDef,
} from "./github/get_repo_contents.js";
import {
  handleListDirectory as handleGitHubListDirectory,
  listDirectoryToolDef,
} from "./github/list_directory.js";

const WORKSPACE_ROOT = process.env["MCP_WORKSPACE_ROOT"] ?? "/workspace";

const server = new Server(
  { name: "secureai-filesystem", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read_file",
      description: "Read the contents of a file inside the workspace root",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "Relative file path" } },
        required: ["path"],
      },
    },
    {
      name: "list_directory",
      description: "List files and directories at a given path",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative directory path (default: .)" },
          recursive: { type: "boolean", default: false },
        },
        required: [],
      },
    },
    {
      name: "search_files",
      description: "Search for files matching a glob-like pattern",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Filename substring or glob pattern" },
          directory: { type: "string", description: "Directory to search within (default: root)" },
        },
        required: ["pattern"],
      },
    },
    {
      name: "get_file_info",
      description: "Get metadata (size, modified date) for a file",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
    getFileContentToolDef,
    listDirectoryToolDef,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "read_file": {
        const resolved = validatePath(WORKSPACE_ROOT, args!["path"] as string);
        const stat = fs.statSync(resolved);
        assertReadable(resolved, stat.size);
        const content = fs.readFileSync(resolved, "utf-8");
        return { content: [{ type: "text", text: content }] };
      }

      case "list_directory": {
        const dirPath = (args?.["path"] as string) ?? ".";
        const resolved = validatePath(WORKSPACE_ROOT, dirPath);
        const recursive = Boolean(args?.["recursive"]);
        const entries = listDir(resolved, recursive);
        return { content: [{ type: "text", text: entries.join("\n") }] };
      }

      case "search_files": {
        const pattern = (args!["pattern"] as string).toLowerCase();
        const base = (args?.["directory"] as string) ?? ".";
        const resolved = validatePath(WORKSPACE_ROOT, base);
        const results = searchFiles(resolved, pattern);
        return { content: [{ type: "text", text: results.join("\n") }] };
      }

      case "get_file_info": {
        const resolved = validatePath(WORKSPACE_ROOT, args!["path"] as string);
        const stat = fs.statSync(resolved);
        const info = {
          path: resolved,
          size: stat.size,
          modified: stat.mtime.toISOString(),
          isDirectory: stat.isDirectory(),
        };
        return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
      }

      case "github_get_file_content":
        return handleGetFileContent(args as Record<string, unknown>);

      case "github_list_directory":
        return handleGitHubListDirectory(args as Record<string, unknown>);

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    if (err instanceof PathValidationError || err instanceof FileFilterError) {
      return { content: [{ type: "text", text: err.message }], isError: true };
    }
    throw err;
  }
});

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out",
  "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
  "target", ".gradle", ".idea", ".vscode",
  ".android", ".kotlin", "androidTest",
  "coverage", ".nyc_output",
]);

function listDir(dir: string, recursive: boolean, prefix = ""): string[] {
  const entries: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    entries.push(entry.isDirectory() ? `${rel}/` : rel);
    if (recursive && entry.isDirectory()) {
      entries.push(...listDir(path.join(dir, entry.name), true, rel));
    }
  }
  return entries;
}

function searchFiles(dir: string, pattern: string, results: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      searchFiles(full, pattern, results);
    } else if (entry.name.toLowerCase().includes(pattern)) {
      results.push(full);
    }
  }
  return results;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
