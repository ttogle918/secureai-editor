# 데이터 모델 (컴포넌트가 표시하는 모양)

> 활성 타입은 `apps/frontend/src/lib/mockData.ts` 기준(`types/index.ts`는 미사용 레거시).

## Vulnerability (취약점 카드/목록이 표시)
```ts
type VulnStatus = 'open' | 'false_positive' | 'fixed';   // 트리아지 결과 상태

interface Vulnerability {
  id: string;
  type: string;              // 'SQL_INJECTION' 등 — 벌크 "이 유형 N건"의 그룹 키
  severity: 'critical'|'high'|'medium'|'low'|'info';
  category?: string;
  lineStart: number; lineEnd: number;
  filePath: string;
  description: string;       // "왜 위험한가" (SAST 결론)
  cweId: string;             // 'CWE-89'  → 참고링크 렌더 가능
  owaspCategory: string;     // 'A03:2021'
  status: VulnStatus;        // 트리아지 배지
  dastResult?: string;       // DAST 증명 결과 요약(proven 배지의 소스)
  apiEndpoint?: string;      // 현재 프론트 휴리스틱 파생 → VAL-18에서 실데이터화
  apiGroup?: string;
  callChain?: CallChainStep[];
}
```
> **VAL-18(예정)**: 여기에 `attackScenario`·`taintedParameter`·`httpMethod`·`references[]`가 추가될 예정. 카드 디자인에 표시 자리를 미리 고려.

## PatchSuggestion (패치 매니저가 표시)
```ts
interface PatchSuggestion {
  vulnId?: string;
  // originalCode / patchedCode(diff), explanation, applied(bool)
  // verificationStatus?: 'PENDING'|'VERIFIED'|'FAILED'   ← TASK-1402 배지
  // pull-request: POST /patches/{id}/pull-request 로 GitHub PR 생성(PR-only)
}
```

## DAST 결과 (SSE 이벤트 — 터미널/워크스페이스가 표시)
- 단건: `{ type:'dast_result', vulnId, success, evidence, payload, responseSnippet }`
- **배치(★신규)**: 각 타깃 `dast_result` 순차 + 최종 `{ type:'dast_batch_complete', total, succeeded, skipped }`
  - 배치 SSE 구독: `?batch=true` (개별 결과로 종료 안 함, batch_complete에서만 종료)

## 트리아지 액션 (벌크/단건 공통)
- action 화이트리스트: `CONFIRM`(→open) · `DISMISS`(→false_positive) · `ACCEPT_PATCH`(→fixed)
- 벌크 응답: `{ requested, applied, skipped, newStatus, appliedVulnIds[] }`
  - 소유X/미존재 취약점은 **조용히 skip** → 프론트는 `appliedVulnIds`로 낙관적 갱신 동기화 + skip 토스트.
