/**
 * 취약점 filePath에서 API 그룹명과 엔드포인트 경로를 추론한다.
 * 백엔드 DB에 apiGroup/apiEndpoint 컬럼이 없으므로 프론트에서 파생.
 */

function normPath(p: string) {
  return p.replace(/\\/g, '/');
}

/**
 * filePath → apiGroup 레이블 추론.
 * - DVWA: `dvwa/vulnerabilities/{type}/...` → `/vulnerabilities/{type}`
 * - Controller/Handler 파일: 클래스명에서 접미어 제거 → `User API`
 * - 그 외: 상위 디렉터리명 사용
 */
export function deriveApiGroup(filePath: string): string | undefined {
  const parts = normPath(filePath).split('/').filter(Boolean);

  // DVWA 전용
  if (parts[0]?.toLowerCase() === 'dvwa' && parts[1] === 'vulnerabilities' && parts[2]) {
    return `/vulnerabilities/${parts[2]}`;
  }

  // Controller / Handler / Router 파일명 탐지
  for (const part of parts) {
    const stem = part.replace(/\.(java|ts|tsx|py|go|php|js|jsx|kt)$/i, '');
    if (/controller/i.test(stem)) {
      const base = stem.replace(/controller$/i, '');
      return base ? `${base.replace(/([A-Z])/g, ' $1').trim()} API` : 'API';
    }
    if (/handler/i.test(stem)) {
      const base = stem.replace(/handler$/i, '');
      return base ? `${base.replace(/([A-Z])/g, ' $1').trim()} Handler` : 'Handler';
    }
    if (/router?$/i.test(stem)) {
      const base = stem.replace(/router?$/i, '');
      return base ? `${base.replace(/([A-Z])/g, ' $1').trim()} Route` : 'Route';
    }
  }

  // 폴더 기반 그룹: 마지막에서 두 번째 경로 세그먼트
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
}

/**
 * filePath + description → 엔드포인트 경로 추론.
 * - DVWA: `/dvwa/vulnerabilities/{type}/`
 * - description 안 path 패턴 추출
 * - 실패 시 빈 문자열
 */
export function deriveEndpoint(filePath: string, description?: string | null): string {
  const parts = normPath(filePath).split('/').filter(Boolean);

  // DVWA
  if (parts[0]?.toLowerCase() === 'dvwa' && parts[1] === 'vulnerabilities' && parts[2]) {
    return `/dvwa/vulnerabilities/${parts[2]}/`;
  }

  // description에서 URL/path 추출
  if (description) {
    const urlMatch = description.match(/https?:\/\/[^\s'"<>]+/);
    if (urlMatch) {
      try { return new URL(urlMatch[0]).pathname; } catch { /* skip */ }
    }
    const pathMatch = description.match(/(?:endpoint|path|route|api|url)\s*[:=]\s*['"`]?(\/?[a-z][a-z0-9\-_/:.{}[\]]*)/i);
    if (pathMatch?.[1]?.startsWith('/')) return pathMatch[1];
  }

  return '';
}
