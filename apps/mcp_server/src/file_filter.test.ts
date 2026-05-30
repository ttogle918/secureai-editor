/**
 * Unit tests for file_filter.ts
 *
 * assertReadable gates which files the AI agent is allowed to read — it blocks
 * binary blobs and oversized files. Both are abuse/DoS-relevant, so the
 * boundaries are worth pinning down.
 */

import { assertReadable, FileFilterError, BINARY_EXTENSIONS } from "./file_filter.js";

const MAX_BYTES = 10 * 1024 * 1024;

describe("assertReadable — allowed files", () => {
  it("allows a small source file", () => {
    expect(() => assertReadable("src/index.ts", 1024)).not.toThrow();
  });

  it("allows a file exactly at the 10 MB limit", () => {
    expect(() => assertReadable("big.txt", MAX_BYTES)).not.toThrow();
  });

  it("allows an empty file", () => {
    expect(() => assertReadable("empty.md", 0)).not.toThrow();
  });

  it("treats extension matching case-insensitively for text files", () => {
    expect(() => assertReadable("README.MD", 10)).not.toThrow();
  });
});

describe("assertReadable — binary extensions", () => {
  it.each([...BINARY_EXTENSIONS])("blocks %s", (ext) => {
    expect(() => assertReadable(`asset${ext}`, 10)).toThrow(FileFilterError);
  });

  it("blocks uppercase binary extensions", () => {
    expect(() => assertReadable("Photo.PNG", 10)).toThrow(/Binary file type not allowed/);
  });

  it("blocks the binary check before the size check", () => {
    // A tiny .exe should still be rejected as binary.
    expect(() => assertReadable("tool.exe", 1)).toThrow(/Binary file type not allowed/);
  });
});

describe("assertReadable — size limit", () => {
  it("blocks a file one byte over the limit", () => {
    expect(() => assertReadable("huge.txt", MAX_BYTES + 1)).toThrow(FileFilterError);
  });

  it("reports the size in the error message", () => {
    expect(() => assertReadable("huge.txt", 20 * 1024 * 1024)).toThrow(/20\.0 MB/);
  });
});

describe("FileFilterError", () => {
  it("has the correct name for instanceof discrimination", () => {
    const err = new FileFilterError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("FileFilterError");
  });
});
