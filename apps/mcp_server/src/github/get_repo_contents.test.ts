/**
 * Unit tests for get_repo_contents.ts (github_get_file_content MCP tool)
 *
 * ESM note: jest.mock() is unavailable in ESM — use jest.unstable_mockModule()
 * and dynamic import the module under test AFTER registering the mock.
 */

import { jest } from "@jest/globals";
import type { GitHubFileContent } from "./github_client.js";

// ─── Mock github_client module ────────────────────────────────────────────────

const mockGetContents = jest.fn();

jest.unstable_mockModule("./github_client.js", () => ({
  getContents: mockGetContents,
  FileFilterError: class FileFilterError extends Error {
    constructor(msg: string) { super(msg); this.name = "FileFilterError"; }
  },
  GitHubAuthError: class GitHubAuthError extends Error {
    constructor(msg: string) { super(msg); this.name = "GitHubAuthError"; }
  },
  GitHubNotFoundError: class GitHubNotFoundError extends Error {
    constructor(msg: string) { super(msg); this.name = "GitHubNotFoundError"; }
  },
  GitHubRateLimitError: class GitHubRateLimitError extends Error {
    constructor(msg: string) { super(msg); this.name = "GitHubRateLimitError"; }
  },
}));

// Import handler AFTER mock registration so it picks up the mock
const { handleGetFileContent } = await import("./get_repo_contents.js");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFileItem(overrides: Partial<GitHubFileContent> = {}): GitHubFileContent {
  const text = "console.log('hello');";
  return {
    name: "index.js",
    path: "src/index.js",
    sha: "abc123",
    size: text.length,
    type: "file",
    content: Buffer.from(text).toString("base64"),
    encoding: "base64",
    download_url: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("handleGetFileContent", () => {
  afterEach(() => {
    mockGetContents.mockReset();
  });

  it("returns decoded file content as text", async () => {
    mockGetContents.mockResolvedValue(makeFileItem());

    const result = await handleGetFileContent({
      owner: "owner",
      repo: "repo",
      path: "src/index.js",
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toBe("console.log('hello');");
  });

  it("returns isError when path is a directory", async () => {
    mockGetContents.mockResolvedValue([makeFileItem(), makeFileItem()]);

    const result = await handleGetFileContent({
      owner: "owner",
      repo: "repo",
      path: "src",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("github_list_directory");
  });

  it("returns isError when path is a symlink type", async () => {
    mockGetContents.mockResolvedValue(makeFileItem({ type: "symlink" }));

    const result = await handleGetFileContent({
      owner: "owner",
      repo: "repo",
      path: "link",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("symlink");
  });

  it("returns isError when FileFilterError is thrown (binary file)", async () => {
    mockGetContents.mockRejectedValue(new Error("Binary file type not allowed: .png"));

    const result = await handleGetFileContent({
      owner: "owner",
      repo: "repo",
      path: "image.png",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Binary file type not allowed");
  });

  it("returns isError on GitHubNotFoundError", async () => {
    mockGetContents.mockRejectedValue(new Error("Not found: owner/repo/missing.txt"));

    const result = await handleGetFileContent({
      owner: "owner",
      repo: "repo",
      path: "missing.txt",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Not found");
  });

  it("returns isError on GitHubAuthError", async () => {
    mockGetContents.mockRejectedValue(new Error("Access forbidden"));

    const result = await handleGetFileContent({
      owner: "owner",
      repo: "repo",
      path: "file.txt",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Access forbidden");
  });

  it("handles base64 content with embedded newlines (GitHub API format)", async () => {
    const text = "line1\nline2\nline3";
    const base64WithNewlines = Buffer.from(text).toString("base64").replace(/.{76}/g, "$&\n");

    mockGetContents.mockResolvedValue(
      makeFileItem({ content: base64WithNewlines, size: text.length })
    );

    const result = await handleGetFileContent({
      owner: "owner",
      repo: "repo",
      path: "file.txt",
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toBe(text);
  });

  it("token value is not echoed in error response", async () => {
    mockGetContents.mockRejectedValue(new Error("Access forbidden"));

    const result = await handleGetFileContent({
      owner: "owner",
      repo: "repo",
      path: "file.txt",
      token: "super-secret-token",
    });

    expect(result.content[0].text).not.toContain("super-secret-token");
  });
});
