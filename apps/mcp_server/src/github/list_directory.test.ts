/**
 * Unit tests for list_directory.ts (github_list_directory MCP tool)
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
const { handleListDirectory } = await import("./list_directory.js");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFile(name: string, dirPath = ""): GitHubFileContent {
  const fullPath = dirPath ? `${dirPath}/${name}` : name;
  return {
    name,
    path: fullPath,
    sha: "abc123",
    size: 100,
    type: "file",
    download_url: null,
  };
}

function makeDir(name: string, parentPath = ""): GitHubFileContent {
  const fullPath = parentPath ? `${parentPath}/${name}` : name;
  return {
    name,
    path: fullPath,
    sha: "def456",
    size: 0,
    type: "dir",
    download_url: null,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("handleListDirectory", () => {
  afterEach(() => {
    mockGetContents.mockReset();
  });

  it("returns a flat list of files and directories", async () => {
    mockGetContents.mockResolvedValue([
      makeDir("src"),
      makeFile("package.json"),
      makeFile("README.md"),
    ]);

    const result = await handleListDirectory({ owner: "owner", repo: "repo" });

    expect(result.isError).toBeFalsy();
    const lines = result.content[0].text.split("\n");
    expect(lines).toContain("src/");
    expect(lines).toContain("package.json");
    expect(lines).toContain("README.md");
  });

  it("returns isError when path resolves to a single file", async () => {
    mockGetContents.mockResolvedValue({
      name: "README.md",
      path: "README.md",
      sha: "abc",
      size: 200,
      type: "file",
      download_url: null,
    });

    const result = await handleListDirectory({
      owner: "owner",
      repo: "repo",
      path: "README.md",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("github_get_file_content");
  });

  it("uses default empty path for root listing", async () => {
    mockGetContents.mockResolvedValue([makeFile("index.ts")]);

    await handleListDirectory({ owner: "owner", repo: "repo" });

    expect(mockGetContents).toHaveBeenCalledWith(
      "owner",
      "repo",
      "",
      undefined,
      undefined
    );
  });

  it("includes binary files in listing without throwing", async () => {
    mockGetContents.mockResolvedValue([
      makeFile("image.png"),
      makeFile("data.bin"),
      makeFile("app.js"),
    ]);

    const result = await handleListDirectory({ owner: "owner", repo: "repo" });

    expect(result.isError).toBeFalsy();
    const lines = result.content[0].text.split("\n");
    expect(lines).toContain("image.png");
    expect(lines).toContain("data.bin");
    expect(lines).toContain("app.js");
  });

  describe("recursive listing", () => {
    it("fetches subdirectories when recursive=true", async () => {
      mockGetContents
        .mockResolvedValueOnce([makeDir("src"), makeFile("package.json")])
        .mockResolvedValueOnce([makeFile("index.ts", "src"), makeFile("utils.ts", "src")]);

      const result = await handleListDirectory({
        owner: "owner",
        repo: "repo",
        recursive: true,
      });

      expect(result.isError).toBeFalsy();
      const lines = result.content[0].text.split("\n");
      expect(lines).toContain("src/");
      expect(lines).toContain("src/index.ts");
      expect(lines).toContain("src/utils.ts");
      expect(lines).toContain("package.json");
    });

    it("stops recursion at depth 3", async () => {
      mockGetContents
        .mockResolvedValueOnce([makeDir("dir-a")])
        .mockResolvedValueOnce([makeDir("dir-b", "dir-a")])
        .mockResolvedValueOnce([makeDir("dir-c", "dir-a/dir-b")]);

      const result = await handleListDirectory({
        owner: "owner",
        repo: "repo",
        recursive: true,
      });

      expect(result.isError).toBeFalsy();
      // root + dir-a + dir-b = 3 calls; dir-c is at depth 3 (not recursed)
      expect(mockGetContents).toHaveBeenCalledTimes(3);
    });

    it("skips subdirectory silently on fetch error and continues", async () => {
      mockGetContents
        .mockResolvedValueOnce([makeDir("broken-dir"), makeFile("ok.ts")])
        .mockRejectedValueOnce(new Error("Network error"));

      const result = await handleListDirectory({
        owner: "owner",
        repo: "repo",
        recursive: true,
      });

      expect(result.isError).toBeFalsy();
      const lines = result.content[0].text.split("\n");
      expect(lines).toContain("broken-dir/");
      expect(lines).toContain("ok.ts");
    });

    it("does NOT recurse when recursive=false (default)", async () => {
      mockGetContents.mockResolvedValue([makeDir("src"), makeFile("README.md")]);

      await handleListDirectory({ owner: "owner", repo: "repo", recursive: false });

      expect(mockGetContents).toHaveBeenCalledTimes(1);
    });
  });

  it("returns isError on GitHubNotFoundError", async () => {
    mockGetContents.mockRejectedValue(new Error("Not found"));

    const result = await handleListDirectory({
      owner: "owner",
      repo: "repo",
      path: "nonexistent",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Not found");
  });

  it("returns isError on GitHubAuthError", async () => {
    mockGetContents.mockRejectedValue(new Error("Forbidden"));

    const result = await handleListDirectory({ owner: "owner", repo: "repo" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Forbidden");
  });

  it("token is passed to getContents but not echoed in output", async () => {
    mockGetContents.mockResolvedValue([makeFile("file.ts")]);

    const result = await handleListDirectory({
      owner: "owner",
      repo: "repo",
      token: "secret-token-xyz",
    });

    expect(mockGetContents).toHaveBeenCalledWith(
      "owner",
      "repo",
      "",
      undefined,
      "secret-token-xyz"
    );

    expect(result.content[0].text).not.toContain("secret-token-xyz");
  });
});
