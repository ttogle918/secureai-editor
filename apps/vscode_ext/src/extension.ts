import * as vscode from 'vscode';
import { analyzeWorkspace } from './apiClient';
import { DiagnosticProvider } from './diagnosticProvider';

// SecretStorage 키 상수 — 매직 문자열 금지
const TOKEN_SECRET_KEY = 'secureai.token';

// 진단 제공자 인스턴스 (deactivate 시 dispose를 위해 모듈 범위에 보관)
let diagnosticProvider: DiagnosticProvider | undefined;

/**
 * Extension 활성화 진입점.
 * 순서: DiagnosticProvider 초기화 → 커맨드 등록
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  diagnosticProvider = new DiagnosticProvider();

  // DiagnosticProvider는 컨텍스트 구독에 등록하여 자동 해제 보장
  context.subscriptions.push(diagnosticProvider);

  registerSetTokenCommand(context);
  registerAnalyzeCommand(context, diagnosticProvider);
}

/**
 * Extension 비활성화 진입점.
 * context.subscriptions 에 등록된 리소스는 자동 해제되므로
 * 별도 작업 없이 dispose 패턴에 위임한다.
 */
export function deactivate(): void {
  // DiagnosticProvider는 context.subscriptions 통해 자동 dispose 됨
}

/**
 * 'secureai.setToken' 커맨드를 등록한다.
 * SRP: 토큰 저장 흐름만 담당한다.
 */
function registerSetTokenCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand(
    'secureai.setToken',
    async () => {
      const token = await vscode.window.showInputBox({
        prompt: 'SecureAI JWT 토큰을 입력하세요',
        password: true,           // 입력 내용 마스킹
        ignoreFocusOut: true,
        placeHolder: 'eyJ...',
      });

      if (!token) {
        // 사용자가 취소하거나 빈 값 입력 시 조용히 종료
        return;
      }

      // 토큰은 VSCode SecretStorage 에만 보관 — 로그·출력 금지
      await context.secrets.store(TOKEN_SECRET_KEY, token);
      vscode.window.showInformationMessage('SecureAI: API 토큰이 저장되었습니다.');
    }
  );

  context.subscriptions.push(command);
}

/**
 * 'secureai.analyze' 커맨드를 등록한다.
 * SRP: 분석 실행 흐름만 담당한다.
 */
function registerAnalyzeCommand(
  context: vscode.ExtensionContext,
  provider: DiagnosticProvider
): void {
  const command = vscode.commands.registerCommand(
    'secureai.analyze',
    async () => {
      // 1. 토큰 확인 — SecretStorage에서 조회
      const token = await context.secrets.get(TOKEN_SECRET_KEY);
      if (!token) {
        vscode.window.showWarningMessage(
          'SecureAI: 먼저 "SecureAI: Set API Token" 명령어로 JWT 토큰을 설정하세요.'
        );
        return;
      }

      // 2. 워크스페이스 경로 확인
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspacePath) {
        vscode.window.showErrorMessage(
          'SecureAI: 열린 워크스페이스가 없습니다. 폴더를 먼저 열어 주세요.'
        );
        return;
      }

      // 3. 분석 실행 — 진행 표시와 함께
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'SecureAI: 보안 분석 중...',
          cancellable: false,
        },
        async () => {
          await runAnalysis(workspacePath, token, provider);
        }
      );
    }
  );

  context.subscriptions.push(command);
}

/**
 * 분석을 실행하고 결과를 DiagnosticProvider 에 반영한다.
 * 오류 발생 시 사용자에게 에러 메시지를 표시한다.
 * SRP: 분석 호출 및 결과 반영만 담당한다.
 */
async function runAnalysis(
  workspacePath: string,
  token: string,
  provider: DiagnosticProvider
): Promise<void> {
  try {
    provider.clearDiagnostics();

    const vulnerabilities = await analyzeWorkspace(workspacePath, token);
    provider.updateDiagnostics(vulnerabilities);

    const count = vulnerabilities.length;
    if (count === 0) {
      vscode.window.showInformationMessage('SecureAI: 취약점이 발견되지 않았습니다.');
    } else {
      vscode.window.showWarningMessage(
        `SecureAI: ${count}개의 취약점이 발견되었습니다. Problems 탭을 확인하세요.`
      );
    }
  } catch (error) {
    // 에러 메시지에 토큰·경로 등 민감 정보 포함 금지
    const message =
      error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    vscode.window.showErrorMessage(`SecureAI: 분석 실패 — ${message}`);
  }
}
