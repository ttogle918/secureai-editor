/**
 * Unit tests for github_client.ts
 *
 * Strategy: mock global fetch to avoid real network calls.
 */

import { jest } from "@jest/globals";
import {
  getContents,
  GitHubAuthError,
  GitHubNotFoundError,
  GitHubRateLimitError,
  FileFilterError,
  type GitHubFileContent,
} from "./github_client.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFileItem(overrides: Partial<GitHubFileContent> = {}): GitHubFileContent {
  return {
    name: "README.md",
    path: "README.md",
    sha: "abc123",
    size: 500,
    type: "file",
    content: Buffer.from("# Hello World").toString("base64"),
    encoding: "base64",
    download_url: "https://raw.githubusercontent.com/owner/repo/main/README.md",
    ...overrides,
  };
}

function makeDirItems(): GitHubFileContent[] {
  return [
    {
      name: "src",
      path: "src",
      sha: "def456",
      size: 0,
      type: "dir",
      download_url: null,
    },
    makeFileItem({ name: "package.json", path: "package.json" }),
  ];
}

function mockFetch(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): void {
  const responseHeaders = new Headers({
    "content-type": "application/json",
    ...headers,
  });

  (global as unknown as Record<string, unknown>)["fetch"] = jest.fn().mockResolvedValue({
    status,
    statusText: String(status),
    ok: status >= 200 && status < 300,
    headers: responseHeaders,
    json: async () => body,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("getContents", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as unknown as Record<string, unknown>)["fetch"];
  });

  it("returns a single GitHubFileContent for a file path", async () => {
    const item = makeFileItem();
    mockFetch(200, item);

    const result = await getContents("owner", "repo", "README.md");

    expect(Array.isArray(result)).toBe(false);
    expect((result as GitHubFileContent).name).toBe("README.md");
  });

  it("returns an array of GitHubFileContent for a directory path", async () => {
    const items = makeDirItems();
    mockFetch(200, items);

    const result = await getContents("owner", "repo", "");

    expect(Array.isArray(result)).toBe(true);
    expect((result as GitHubFileContent[]).length).toBe(2);
  });

  it("throws GitHubAuthError on 403 response", async () => {
    mockFetch(403, { message: "Forbidden" });

    await expect(getContents("owner", "repo", "private.txt")).rejects.toBeInstanceOf(GitHubAuthError);
  });

  it("throws GitHubNotFoundError on 404 response", async () => {
    mockFetch(404, { message: "Not Found" });

    await expect(getContents("owner", "repo", "nonexistent.txt")).rejects.toBeInstanceOf(GitHubNotFoundError);
  });

  it("throws GitHubRateLimitError after exhausting retries on 429", async () => {
    mockFetch(429, { message: "rate limit exceeded" });

    await expect(getContents("owner", "repo", "file.txt")).rejects.toBeInstanceOf(GitHubRateLimitError);
  });

  it("throws GitHubRateLimitError when x-ratelimit-remaining is 0", async () => {
    mockFetch(200, makeFileItem(), { "x-ratelimit-remaining": "0" });

    await expect(getContents("owner", "repo", "file.txt")).rejects.toBeInstanceOf(GitHubRateLimitError);
  });

  it("throws FileFilterError for binary file extension", async () => {
    mockFetch(200, makeFileItem({ name: "app.exe", path: "app.exe", size: 1000 }));

    await expect(getContents("owner", "repo", "app.exe")).rejects.toBeInstanceOf(FileFilterError);
  });

  it("throws FileFilterError for file exceeding 10 MB", async () => {
    mockFetch(200, makeFileItem({ size: 11 * 1024 * 1024 }));

    await expect(getContents("owner", "repo", "huge.txt")).rejects.toBeInstanceOf(FileFilterError);
  });

  it("does not throw FileFilterError for directory entries", async () => {
    mockFetch(200, makeDirItems());

    const result = await getContents("owner", "repo", "");
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws Error on unexpected non-OK status", async () => {
    mockFetch(500, { message: "Internal Server Error" });

    await expect(getContents("owner", "repo", "file.txt")).rejects.toThrow("GitHub API error");
  });

  it("throws on path traversal attempt", async () => {
    await expect(getContents("owner", "repo", "../etc/passwd")).rejects.toThrow("Path traversal");
  });

  it("uses GITHUB_TOKEN env variable when no token arg is provided", async () => {
    const item = makeFileItem();
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => item,
    });
    (global as unknown as Record<string, unknown>)["fetch"] = fetchMock;

    process.env["GITHUB_TOKEN"] = "env-token-abc";
    try {
      await getContents("owner", "repo", "README.md");
      const callArgs = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
      expect((callArgs.headers as Record<string, string>)["Authorization"]).toBe("Bearer env-token-abc");
    } finally {
      delete process.env["GITHUB_TOKEN"];
    }
  });

  it("does not include Authorization header when no token is available", async () => {
    const item = makeFileItem();
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => item,
    });
    (global as unknown as Record<string, unknown>)["fetch"] = fetchMock;
    delete process.env["GITHUB_TOKEN"];

    await getContents("owner", "repo", "README.md");
    const callArgs = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    expect((callArgs.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });

  it("token argument is never echoed in error messages", async () => {
    mockFetch(403, { message: "Forbidden" });

    try {
      await getContents("owner", "repo", "file.txt", undefined, "super-secret-token");
    } catch (err) {
      expect(String(err)).not.toContain("super-secret-token");
    }
  });
});
