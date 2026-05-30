/**
 * Unit tests for path_validator.ts
 *
 * validatePath is the path-traversal / symlink-escape guard that protects every
 * filesystem operation exposed over MCP, so these cases are security-critical.
 * It calls fs.realpathSync against the real filesystem, so we build a real
 * temp directory tree (including symlinks) rather than mocking fs.
 */

import { jest } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validatePath, PathValidationError } from "./path_validator.js";

let root: string;
let outside: string;

beforeEach(() => {
  // A fresh sandbox root plus a sibling "outside" dir for escape tests.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "pathval-"));
  root = path.join(base, "root");
  outside = path.join(base, "outside");
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
});

describe("validatePath — allowed paths", () => {
  it("resolves a simple relative file inside the root", () => {
    const resolved = validatePath(root, "src/index.ts");
    expect(resolved).toBe(path.join(root, "src/index.ts"));
  });

  it("allows the root itself", () => {
    expect(validatePath(root, ".")).toBe(path.resolve(root));
  });

  it("allows nested paths that stay inside the root", () => {
    const resolved = validatePath(root, "a/b/c/deep.txt");
    expect(resolved).toBe(path.join(root, "a/b/c/deep.txt"));
  });

  it("allows a non-existent file (write target) inside the root", () => {
    // File doesn't exist yet — realpathSync throws ENOENT, which must be tolerated.
    expect(() => validatePath(root, "new-file.ts")).not.toThrow();
  });
});

describe("validatePath — traversal escapes", () => {
  it("rejects ../ escaping the root", () => {
    expect(() => validatePath(root, "../outside/secret.txt")).toThrow(PathValidationError);
  });

  it("rejects deep ../../ traversal", () => {
    expect(() => validatePath(root, "a/b/../../../etc/passwd")).toThrow(PathValidationError);
  });

  it("rejects an absolute path pointing outside the root", () => {
    expect(() => validatePath(root, path.join(outside, "x.txt"))).toThrow(PathValidationError);
  });

  it("rejects a sibling-prefix path that is not actually inside the root", () => {
    // `${root}-evil` shares the root string prefix but is a different directory;
    // the `+ path.sep` check must prevent a false match.
    const sibling = `${root}-evil`;
    fs.mkdirSync(sibling, { recursive: true });
    expect(() => validatePath(root, path.join(sibling, "x.txt"))).toThrow(PathValidationError);
  });
});

describe("validatePath — symlink escapes", () => {
  it("rejects a symlink whose target is outside the root", () => {
    const secret = path.join(outside, "secret.txt");
    fs.writeFileSync(secret, "top secret");
    const link = path.join(root, "link.txt");
    try {
      fs.symlinkSync(secret, link);
    } catch {
      return; // platform without symlink support — skip
    }
    expect(() => validatePath(root, "link.txt")).toThrow(/Symlink escapes root/);
  });

  it("allows a symlink whose target stays inside the root", () => {
    const real = path.join(root, "real.txt");
    fs.writeFileSync(real, "data");
    const link = path.join(root, "alias.txt");
    try {
      fs.symlinkSync(real, link);
    } catch {
      return;
    }
    expect(() => validatePath(root, "alias.txt")).not.toThrow();
  });
});

describe("validatePath — sensitive dotfiles", () => {
  it("blocks .env", () => {
    expect(() => validatePath(root, ".env")).toThrow(/\.env files is forbidden/);
  });

  it("blocks .env.* variants", () => {
    expect(() => validatePath(root, "config/.env.production")).toThrow(/\.env files is forbidden/);
  });

  it("does not block unrelated dotfiles like .gitignore", () => {
    expect(() => validatePath(root, ".gitignore")).not.toThrow();
  });

  it("does not block files that merely contain 'env' in the name", () => {
    expect(() => validatePath(root, "environment.ts")).not.toThrow();
  });
});

describe("PathValidationError", () => {
  it("has the correct name for instanceof discrimination", () => {
    const err = new PathValidationError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PathValidationError");
  });
});
