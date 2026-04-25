import path from "node:path";
import fs from "node:fs";

export class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathValidationError";
  }
}

/**
 * Resolves `target` relative to `rootPath` and throws if the resolved path
 * escapes the root, is a symlink to outside the root, or is a dotfile like .env.
 */
export function validatePath(rootPath: string, target: string): string {
  const resolvedRoot = path.resolve(rootPath);
  const resolved = path.resolve(resolvedRoot, target);

  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    throw new PathValidationError(`Path traversal detected: ${target}`);
  }

  // Resolve symlinks and re-check
  try {
    const real = fs.realpathSync(resolved);
    if (!real.startsWith(resolvedRoot + path.sep) && real !== resolvedRoot) {
      throw new PathValidationError(`Symlink escapes root: ${target}`);
    }
  } catch (err) {
    if (err instanceof PathValidationError) throw err;
    // File doesn't exist yet — that's fine for write operations
  }

  // Block sensitive dotfiles
  const basename = path.basename(resolved);
  if (basename === ".env" || basename.startsWith(".env.")) {
    throw new PathValidationError(`Access to .env files is forbidden`);
  }

  return resolved;
}
