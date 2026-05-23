import * as vscode from 'vscode';
import { Vulnerability } from './apiClient';

// severity → DiagnosticSeverity 매핑 상수 (OCP: 매핑 테이블 분리로 확장 용이)
const SEVERITY_MAP: Record<Vulnerability['severity'], vscode.DiagnosticSeverity> = {
  CRITICAL: vscode.DiagnosticSeverity.Error,
  HIGH: vscode.DiagnosticSeverity.Error,
  MEDIUM: vscode.DiagnosticSeverity.Warning,
  LOW: vscode.DiagnosticSeverity.Information,
};

/**
 * VSCode Diagnostics(Problems 탭) 를 관리한다.
 * SRP: DiagnosticsCollection 생성·업데이트·초기화만 담당한다.
 */
export class DiagnosticProvider {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('secureai');
  }

  /**
   * 취약점 목록을 파일별로 그룹화하여 Problems 탭에 표시한다.
   */
  updateDiagnostics(vulnerabilities: Vulnerability[]): void {
    this.collection.clear();

    const byFile = groupByFile(vulnerabilities);

    for (const [filePath, items] of byFile.entries()) {
      const uri = vscode.Uri.file(filePath);
      const diagnostics = items.map(toDiagnostic);
      this.collection.set(uri, diagnostics);
    }
  }

  /**
   * Problems 탭에서 모든 secureai 진단 항목을 제거한다.
   */
  clearDiagnostics(): void {
    this.collection.clear();
  }

  /**
   * DiagnosticCollection 리소스를 해제한다.
   * Extension deactivate 시 호출해야 한다.
   */
  dispose(): void {
    this.collection.dispose();
  }
}

/**
 * 취약점 목록을 파일 경로 기준으로 그룹화한다.
 * SRP: 그룹화 로직만 담당하는 순수 함수다.
 */
function groupByFile(
  vulnerabilities: Vulnerability[]
): Map<string, Vulnerability[]> {
  const map = new Map<string, Vulnerability[]>();

  for (const vuln of vulnerabilities) {
    const existing = map.get(vuln.filePath) ?? [];
    existing.push(vuln);
    map.set(vuln.filePath, existing);
  }

  return map;
}

/**
 * Vulnerability 모델을 vscode.Diagnostic 으로 변환한다.
 * SRP: 변환 로직만 담당하는 순수 함수다.
 */
function toDiagnostic(vuln: Vulnerability): vscode.Diagnostic {
  // line은 1-based → VSCode Range는 0-based
  const lineIndex = Math.max(0, vuln.line - 1);
  const range = new vscode.Range(lineIndex, 0, lineIndex, Number.MAX_SAFE_INTEGER);

  const message = vuln.cweId
    ? `[${vuln.cweId}] ${vuln.message}`
    : vuln.message;

  const diagnostic = new vscode.Diagnostic(
    range,
    message,
    SEVERITY_MAP[vuln.severity]
  );

  diagnostic.source = 'SecureAI';
  diagnostic.code = vuln.cweId;

  return diagnostic;
}
