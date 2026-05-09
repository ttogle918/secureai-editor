// ============================================================
// MOCK DATA — SecureAI Frontend (확장판)
// ============================================================

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type VulnStatus = 'open' | 'exploited' | 'patched' | 'pending';

export interface CallChainStep {
  layer: 'Frontend' | 'Controller' | 'Service' | 'Repository' | 'Config';
  label: string;
  file: string;
  filePath: string;
  line: number;
  codeSnippet?: string;
  isVulnerable: boolean;
}

export type VulnCategory = 'SECURITY' | 'CODE_QUALITY';

export interface Vulnerability {
  id: string;
  type: string;
  severity: Severity;
  category?: VulnCategory;
  lineStart: number;
  lineEnd: number;
  filePath: string;
  description: string;
  cweId: string;
  owaspCategory: string;
  status: VulnStatus;
  dastResult?: string;
  apiEndpoint?: string;
  apiGroup?: string;
  callChain?: CallChainStep[];
}

export interface PatchSuggestion {
  vulnId: string;
  originalCode: string;
  patchedCode: string;
  explanation: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  language?: string;
  vulnCount?: number;
  expanded?: boolean;
  children?: FileNode[];
}

export interface DastLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface GithubPR {
  id: number;
  number: number;
  title: string;
  branch: string;
  status: 'pass' | 'fail' | 'warning' | 'running';
  vulnCount: number;
  detail: string;
  time: string;
}

// ─── 파일 트리 ───────────────────────────────────────────────
export const mockFileTree: FileNode[] = [
  {
    name: 'my-spring-project', path: '/', type: 'dir', expanded: true,
    children: [
      {
        name: 'src/main/java', path: '/src/main/java', type: 'dir', expanded: true,
        children: [
          { name: 'UserAuth.java',   path: '/src/main/java/UserAuth.java',   type: 'file', language: 'java',       vulnCount: 3 },
          { name: 'PaymentSvc.java', path: '/src/main/java/PaymentSvc.java', type: 'file', language: 'java',       vulnCount: 1 },
          { name: 'OrderAPI.java',   path: '/src/main/java/OrderAPI.java',   type: 'file', language: 'java',       vulnCount: 0 },
          { name: 'FileUpload.java', path: '/src/main/java/FileUpload.java', type: 'file', language: 'java',       vulnCount: 2 },
        ],
      },
      {
        name: 'src/main/resources', path: '/src/main/resources', type: 'dir', expanded: false,
        children: [
          { name: 'config.properties', path: '/src/main/resources/config.properties', type: 'file', language: 'ini', vulnCount: 1 },
        ],
      },
    ],
  },
];

// ─── 코드 파일 내용 ──────────────────────────────────────────
export const mockFileContents: Record<string, string> = {
  '/src/main/java/UserAuth.java': `package com.example.auth;
import java.sql.*;

public class UserAuth {
    private static final String DB_URL = "jdbc:mysql://localhost/mydb";
    // WARNING: 하드코딩된 시크릿
    private static final String SECRET = "super_secret_key_1234";

    public User findUserByName(String username) throws SQLException {
        Connection conn = DriverManager.getConnection(DB_URL);
        // CRITICAL: SQL Injection 취약점
        String query = "SELECT * FROM users WHERE name = '" + username + "'";
        Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery(query);
        if (rs.next()) {
            return new User(rs.getString("id"), rs.getString("name"));
        }
        return null;
    }

    public boolean verifyToken(String inputToken, String userToken) {
        // HIGH: == 연산자로 문자열 비교 (Broken Auth)
        if (inputToken == userToken) {
            return true;
        }
        return false;
    }

    public void resetPassword(String userId, String newPassword) {
        // MEDIUM: 비밀번호 복잡도 검사 없음
        updatePasswordInDB(userId, newPassword);
    }

    private void updatePasswordInDB(String userId, String password) { }
}`,

  '/src/main/java/PaymentSvc.java': `package com.example.payment;

public class PaymentSvc {
    public void processPayment(String userId, double amount) {
        // HIGH: 금액 검증 없음
        if (userId != null) {
            executePayment(userId, amount);
        }
    }
    private void executePayment(String userId, double amount) {
        System.out.println("Processing: " + userId + " -> " + amount);
    }
}`,

  '/src/main/java/OrderAPI.java': `package com.example.order;

public class OrderAPI {
    public Order getOrder(String orderId, String userId) {
        Order order = orderRepository.findById(orderId);
        if (order != null && order.getUserId().equals(userId)) {
            return order;
        }
        throw new UnauthorizedException("Access denied");
    }
}`,

  '/src/main/java/FileUpload.java': `package com.example.upload;
import java.io.*;

public class FileUpload {
    // HIGH: 파일 확장자 검증 없음
    public void uploadFile(String fileName, byte[] content) {
        File file = new File("/uploads/" + fileName);
        try (FileOutputStream fos = new FileOutputStream(file)) {
            fos.write(content);
        } catch (IOException e) { e.printStackTrace(); }
    }

    // HIGH: Path Traversal 취약점
    public byte[] downloadFile(String fileName) throws IOException {
        File file = new File("/uploads/" + fileName);
        return java.nio.file.Files.readAllBytes(file.toPath());
    }
}`,
};

// ─── 취약점 목록 (callChain + apiGroup 포함) ────────────────
export const mockVulnerabilities: Vulnerability[] = [
  {
    id: 'vuln-001',
    type: 'SQL Injection',
    severity: 'critical',
    lineStart: 12, lineEnd: 14,
    filePath: '/src/main/java/UserAuth.java',
    description: '사용자 입력값을 검증 없이 SQL 쿼리에 직접 삽입. 공격자가 임의의 SQL을 실행하여 DB 전체를 탈취할 수 있습니다.',
    cweId: 'CWE-89',
    owaspCategory: 'A03:2021',
    status: 'exploited',
    dastResult: "' OR '1'='1' -- 페이로드 실행 → DB 레코드 15개 노출 확인",
    apiEndpoint: 'POST /api/users/login',
    apiGroup: '/api/users',
    callChain: [
      { layer: 'Frontend',    label: 'LoginForm.handleSubmit()',       file: 'App.tsx',            filePath: '/src/main/java/App.tsx',            line: 18,  codeSnippet: "fetch('/api/users/login', { method: 'POST', body: formData })", isVulnerable: false },
      { layer: 'Controller',  label: 'UserController.login()',         file: 'UserController.java', filePath: '/src/main/java/UserController.java', line: 34,  codeSnippet: 'authService.authenticate(username, password)',              isVulnerable: false },
      { layer: 'Service',     label: 'AuthService.authenticate()',     file: 'AuthService.java',   filePath: '/src/main/java/AuthService.java',   line: 22,  codeSnippet: 'userAuth.findByCredentials(username, password)',            isVulnerable: false },
      { layer: 'Repository',  label: 'UserAuth.findUserByName()',      file: 'UserAuth.java',      filePath: '/src/main/java/UserAuth.java',      line: 12,  codeSnippet: '"SELECT * FROM users WHERE name = \'" + username + "\'"',   isVulnerable: true  },
    ],
  },
  {
    id: 'vuln-002',
    type: 'Hardcoded Secret',
    severity: 'high',
    lineStart: 6, lineEnd: 7,
    filePath: '/src/main/java/UserAuth.java',
    description: 'API 시크릿 키가 소스코드에 하드코딩. Git 저장소에 커밋될 경우 외부에 노출됩니다.',
    cweId: 'CWE-798',
    owaspCategory: 'A02:2021',
    status: 'open',
    apiEndpoint: undefined,
    apiGroup: undefined,
  },
  {
    id: 'vuln-003',
    type: 'Broken Authentication',
    severity: 'high',
    lineStart: 21, lineEnd: 25,
    filePath: '/src/main/java/UserAuth.java',
    description: 'Java에서 == 연산자는 문자열 참조를 비교합니다. .equals()를 사용해야 올바른 비교가 됩니다.',
    cweId: 'CWE-287',
    owaspCategory: 'A07:2021',
    status: 'patched',
    apiEndpoint: 'POST /api/users/verify',
    apiGroup: '/api/users',
    callChain: [
      { layer: 'Frontend',   label: 'TokenRefresh.request()',      file: 'App.tsx',            filePath: '/src/main/java/App.tsx',            line: 44, codeSnippet: "fetch('/api/users/verify')",                    isVulnerable: false },
      { layer: 'Controller', label: 'UserController.verify()',     file: 'UserController.java', filePath: '/src/main/java/UserController.java', line: 56, codeSnippet: 'authService.verifyToken(token)',                isVulnerable: false },
      { layer: 'Service',    label: 'AuthService.verifyToken()',   file: 'AuthService.java',   filePath: '/src/main/java/AuthService.java',   line: 40, codeSnippet: 'userAuth.verifyToken(input, stored)',            isVulnerable: false },
      { layer: 'Repository', label: 'UserAuth.verifyToken()',      file: 'UserAuth.java',      filePath: '/src/main/java/UserAuth.java',      line: 21, codeSnippet: 'if (inputToken == userToken)',                   isVulnerable: true  },
    ],
  },
  {
    id: 'vuln-004',
    type: 'Broken Business Logic',
    severity: 'high',
    lineStart: 4, lineEnd: 8,
    filePath: '/src/main/java/PaymentSvc.java',
    description: '결제 금액 유효성 검사 없음. 음수 금액이나 0원 결제가 가능합니다.',
    cweId: 'CWE-20',
    owaspCategory: 'A04:2021',
    status: 'open',
    apiEndpoint: 'POST /api/payment/process',
    apiGroup: '/api/payment',
    callChain: [
      { layer: 'Frontend',   label: 'PaymentForm.submit()',       file: 'Payment.tsx',        filePath: '/src/main/java/Payment.tsx',        line: 32, codeSnippet: "fetch('/api/payment/process', { body: {amount} })", isVulnerable: false },
      { layer: 'Controller', label: 'PaymentController.pay()',    file: 'PaymentCtrl.java',   filePath: '/src/main/java/PaymentCtrl.java',   line: 18, codeSnippet: 'paymentSvc.processPayment(userId, amount)',         isVulnerable: false },
      { layer: 'Service',    label: 'PaymentSvc.processPayment()',file: 'PaymentSvc.java',    filePath: '/src/main/java/PaymentSvc.java',    line: 4,  codeSnippet: 'if (userId != null) executePayment(...)',           isVulnerable: true  },
    ],
  },
  {
    id: 'vuln-005',
    type: 'Path Traversal',
    severity: 'high',
    lineStart: 15, lineEnd: 18,
    filePath: '/src/main/java/FileUpload.java',
    description: '파일 경로를 사용자 입력으로 직접 구성. "../../../etc/passwd" 경로로 서버 파일 접근 가능.',
    cweId: 'CWE-22',
    owaspCategory: 'A01:2021',
    status: 'open',
    apiEndpoint: 'GET /api/files/download',
    apiGroup: '/api/files',
    callChain: [
      { layer: 'Frontend',   label: 'FileManager.download()',   file: 'FileManager.tsx',  filePath: '/src/main/java/FileManager.tsx',  line: 22, codeSnippet: "fetch('/api/files/download?name=' + fileName)",    isVulnerable: false },
      { layer: 'Controller', label: 'FileController.download()',file: 'FileCtrl.java',    filePath: '/src/main/java/FileCtrl.java',    line: 14, codeSnippet: 'fileUpload.downloadFile(fileName)',                isVulnerable: false },
      { layer: 'Service',    label: 'FileUpload.downloadFile()',file: 'FileUpload.java',  filePath: '/src/main/java/FileUpload.java',  line: 15, codeSnippet: 'new File("/uploads/" + fileName)',                  isVulnerable: true  },
    ],
  },
  {
    id: 'vuln-006',
    type: 'Weak Password Policy',
    severity: 'medium',
    lineStart: 28, lineEnd: 31,
    filePath: '/src/main/java/UserAuth.java',
    description: '비밀번호 재설정 시 복잡도 검사, 길이 제한 등의 정책이 없습니다.',
    cweId: 'CWE-521',
    owaspCategory: 'A07:2021',
    status: 'open',
    apiEndpoint: 'POST /api/users/reset-password',
    apiGroup: '/api/users',
  },
];

// ─── 패치 제안 ───────────────────────────────────────────────
export const mockPatches: PatchSuggestion[] = [
  {
    vulnId: 'vuln-001',
    originalCode: `String query = "SELECT * FROM users WHERE name = '" + username + "'";
Statement stmt = conn.createStatement();
ResultSet rs = stmt.executeQuery(query);`,
    patchedCode: `String query = "SELECT * FROM users WHERE name = ?";
PreparedStatement stmt = conn.prepareStatement(query);
stmt.setString(1, username);
ResultSet rs = stmt.executeQuery();`,
    explanation: 'PreparedStatement를 사용하면 SQL Injection을 원천 차단합니다. 사용자 입력이 파라미터로 처리되어 SQL 구문으로 해석되지 않습니다.',
  },
  {
    vulnId: 'vuln-003',
    originalCode: `if (inputToken == userToken) {
    return true;
}`,
    patchedCode: `if (inputToken != null && inputToken.equals(userToken)) {
    return true;
}`,
    explanation: '문자열 비교는 반드시 .equals() 메서드를 사용해야 합니다.',
  },
  {
    vulnId: 'vuln-004',
    originalCode: `public void processPayment(String userId, double amount) {
    if (userId != null) {
        executePayment(userId, amount);
    }
}`,
    patchedCode: `public void processPayment(String userId, double amount) {
    if (userId == null || userId.isBlank()) {
        throw new IllegalArgumentException("userId is required");
    }
    if (amount <= 0) {
        throw new IllegalArgumentException("amount must be positive");
    }
    executePayment(userId, amount);
}`,
    explanation: '금액과 사용자 ID에 대한 명시적인 유효성 검사를 추가합니다.',
  },
];

// ─── DAST 로그 ───────────────────────────────────────────────
export const mockDastLogs: DastLog[] = [
  { timestamp: '10:42:01', level: 'info',    message: 'Docker 샌드박스 초기화 중...' },
  { timestamp: '10:42:02', level: 'info',    message: '타겟: UserAuth.java → findUserByName()' },
  { timestamp: '10:42:03', level: 'info',    message: 'SQL Injection 페이로드 생성 중...' },
  { timestamp: '10:42:04', level: 'warn',    message: "페이로드 #1: ' OR '1'='1' -- 주입 시도" },
  { timestamp: '10:42:05', level: 'error',   message: '[EXPLOIT] 성공: DB 레코드 15개 노출 확인' },
  { timestamp: '10:42:06', level: 'warn',    message: "페이로드 #2: '; DROP TABLE users; -- 주입 시도" },
  { timestamp: '10:42:07', level: 'error',   message: '[EXPLOIT] 성공: DDL 실행 가능 확인' },
  { timestamp: '10:42:08', level: 'success', message: '패치 제안 생성 완료 → PreparedStatement 적용 권장' },
];

// ─── 채팅 ────────────────────────────────────────────────────
export const mockChatMessages: ChatMessage[] = [
  { id: 'msg-001', role: 'ai',   content: '안녕하세요! SecureAI 보안 에이전트입니다.\n분석할 파일을 선택하거나 궁금한 점을 질문해주세요.', timestamp: '10:40:00' },
  { id: 'msg-002', role: 'user', content: 'UserAuth.java 파일 분석해줘', timestamp: '10:41:00' },
  { id: 'msg-003', role: 'ai',   content: 'SAST 분석 완료! UserAuth.java에서 3개 취약점을 발견했습니다.\n\n🔴 Critical: SQL Injection (Line 12)\n🟠 High: Hardcoded Secret (Line 6)\n🟠 High: Broken Auth (Line 21)\n\n가장 심각한 SQL Injection부터 DAST로 검증할까요?', timestamp: '10:41:30' },
  { id: 'msg-004', role: 'user', content: 'DAST 실행해줘', timestamp: '10:41:50' },
  { id: 'msg-005', role: 'ai',   content: '⚠️ DAST 결과: 익스플로잇 성공\n\nDocker 샌드박스 시뮬레이션 결과, SQL Injection이 실제로 동작함을 확인했습니다. DB 레코드 15개가 노출되었습니다.\n\n패치 코드를 생성해드릴까요?', timestamp: '10:42:10' },
];

// ─── 대시보드 통계 ───────────────────────────────────────────
export const mockDashboardStats = {
  totalVulns: 14,
  critical: 3,
  high: 7,
  medium: 3,
  low: 1,
  patched: 4,
  securityScore: 62,
  owaspCoverage: [
    { id: 'A01', label: 'Broken Access Control',       hit: true  },
    { id: 'A02', label: 'Cryptographic Failures',      hit: true  },
    { id: 'A03', label: 'Injection',                   hit: true  },
    { id: 'A04', label: 'Insecure Design',             hit: true  },
    { id: 'A05', label: 'Security Misconfiguration',   hit: false },
    { id: 'A06', label: 'Vulnerable Components',       hit: false },
    { id: 'A07', label: 'Auth Failures',               hit: true  },
    { id: 'A08', label: 'Software/Data Integrity',     hit: false },
    { id: 'A09', label: 'Security Logging Failures',   hit: false },
    { id: 'A10', label: 'SSRF',                        hit: false },
  ],
  fileHeatmap: [
    { file: 'UserAuth.java',   count: 3, severity: 'critical' as const },
    { file: 'FileUpload.java', count: 2, severity: 'high'     as const },
    { file: 'PaymentSvc.java', count: 1, severity: 'high'     as const },
    { file: 'OrderAPI.java',   count: 0, severity: 'low'      as const },
  ],
  trend: [
    { date: '03/14', critical: 5, high: 9, medium: 4, score: 41 },
    { date: '03/15', critical: 4, high: 8, medium: 4, score: 47 },
    { date: '03/16', critical: 4, high: 8, medium: 3, score: 50 },
    { date: '03/17', critical: 3, high: 8, medium: 3, score: 53 },
    { date: '03/18', critical: 3, high: 7, medium: 3, score: 58 },
    { date: '03/19', critical: 3, high: 7, medium: 3, score: 60 },
    { date: '03/20', critical: 3, high: 7, medium: 3, score: 62 },
  ],
};

// ─── GitHub PR ───────────────────────────────────────────────
export const mockGithubPRs: GithubPR[] = [
  { id: 1, number: 42, title: 'feature/auth-refactor',  branch: 'feature/auth-refactor',  status: 'fail',    vulnCount: 3, detail: 'SQL Injection Critical 발견', time: '10분 전' },
  { id: 2, number: 41, title: 'fix/payment-null-check', branch: 'fix/payment-null',        status: 'pass',    vulnCount: 0, detail: '취약점 없음',                 time: '1시간 전' },
  { id: 3, number: 40, title: 'feat/file-upload',       branch: 'feat/file-upload',        status: 'warning', vulnCount: 2, detail: 'Path Traversal Medium 2건',  time: '3시간 전' },
  { id: 4, number: 39, title: 'refactor/order-service', branch: 'refactor/order',          status: 'pass',    vulnCount: 0, detail: '취약점 없음',                 time: '1일 전' },
  { id: 5, number: 38, title: 'feat/payment-v2',        branch: 'feat/payment-v2',         status: 'running', vulnCount: 0, detail: '분석 중...',                  time: '방금 전' },
];
