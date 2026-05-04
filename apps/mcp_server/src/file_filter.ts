export class FileFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileFilterError";
  }
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const BINARY_EXTENSIONS = new Set([
  ".exe", ".dll", ".so", ".dylib",
  ".jar", ".war", ".ear", ".class",
  ".zip", ".gz", ".tar", ".7z", ".rar",
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".ico",
  ".pdf", ".docx", ".xlsx", ".pptx",
  ".bin", ".dat", ".db", ".sqlite",
  ".mp3", ".mp4", ".mov", ".avi",
  ".woff", ".woff2", ".ttf", ".eot",
]);

export function assertReadable(filePath: string, fileSizeBytes: number): void {
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();

  if (BINARY_EXTENSIONS.has(ext)) {
    throw new FileFilterError(`Binary file type not allowed: ${ext}`);
  }

  if (fileSizeBytes > MAX_BYTES) {
    throw new FileFilterError(
      `File too large: ${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB (max 10 MB)`
    );
  }
}
