/**
 * Tauri 데스크탑 환경 여부 감지 및 네이티브 파일 시스템 접근 유틸.
 *
 * 모든 함수는 Tauri 플러그인을 dynamic import로 로드한다.
 * 웹 브라우저에서는 @tauri-apps/* 패키지가 undefined를 반환하므로
 * isTauri() 체크 후 호출해야 한다.
 */

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out',
  'target', '.gradle', '__pycache__', '.pytest_cache',
  'coverage', '.idea', '.vscode', '.DS_Store',
]);

const TEXT_EXTS = /\.(ts|tsx|js|jsx|java|kt|py|go|rs|rb|php|cs|cpp|c|h|sql|json|yaml|yml|xml|md|txt|properties|toml|sh|bash|gitignore)$/i;

const MAX_FILE_BYTES = 500_000;

export interface CollectedFile {
  path: string;
  content: string;
}

/** 네이티브 폴더 선택 다이얼로그 (Tauri 전용) */
export async function pickDirectoryNative(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const result = await open({
    directory: true,
    multiple: false,
    title: '분석할 프로젝트 폴더 선택',
  });
  return typeof result === 'string' ? result : null;
}

/** 디렉토리를 재귀적으로 읽어 텍스트 파일 목록을 반환 (Tauri 전용) */
export async function readDirectoryNative(
  dirPath: string,
  relativePath = '',
  collected: CollectedFile[] = [],
): Promise<CollectedFile[]> {
  const { readDir, readTextFile, stat } = await import('@tauri-apps/plugin-fs');

  const entries = await readDir(dirPath);

  for (const entry of entries) {
    const name = entry.name ?? '';
    const fullPath = `${dirPath}/${name}`;
    const relPath  = relativePath ? `${relativePath}/${name}` : name;

    if (entry.isDirectory) {
      if (SKIP_DIRS.has(name)) continue;
      await readDirectoryNative(fullPath, relPath, collected);
    } else {
      if (!TEXT_EXTS.test(name)) continue;
      try {
        const info = await stat(fullPath);
        if (info.size > MAX_FILE_BYTES) continue;
        const content = await readTextFile(fullPath);
        collected.push({ path: relPath, content });
      } catch {
        // 읽기 권한 없음 등 — 스킵
      }
    }
  }

  return collected;
}

/** 경로 문자열에서 디렉토리명(마지막 세그먼트)을 추출 */
export function dirNameFromPath(fullPath: string): string {
  return fullPath.replace(/\\/g, '/').split('/').pop() ?? fullPath;
}
