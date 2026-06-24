# SecureAI AI Engine 고도화 구현 계획 (V2)

**작성일**: 2026-06-21
**목적**: 사용자(리드 개발자)와의 논의를 거쳐 결정된 AI 엔진의 구조적 고도화(다중 페르소나, 비용 예측, 교차 검증, CTI 상태 확장) 구현 방안 명세

---

## 1. 다중 페르소나 (Persona) 시스템 구축

기존 `.claude/rules/`는 개발자 보조용 AI 프롬프트이므로, AI Engine 내부 에이전트들이 사용할 독자적인 페르소나 시스템을 구축한다.

### 추천 및 설계 결정된 4종의 전문가 페르소나
자동화된 보안 플랫폼을 위해 다음 4개의 세분화된 전문가 페르소나를 시스템 프롬프트로 분리 구현한다.
1. **Security Architect (보안 아키텍트 / Planner)**
   - 역할: 코드베이스의 컨텍스트 파악, 위협 모델링, 파일 우선순위 지정 및 DAST 테스트 시나리오 설계
2. **Vulnerability Analyst (취약점 분석가 / SAST Auditor)**
   - 역할: 소스코드 보안 결함 탐지, 오탐 최소화, 심각도(Severity) 분류 (Red Team)
3. **Remediation Engineer (복구 엔지니어 / Patcher)**
   - 역할: 발견된 취약점에 대한 빠르고 안전한 패치 생성, 비즈니스 로직 훼손 방지 (Blue Team)
4. **Security QA (보안 검증 테스터 / Reviewer)**
   - 역할: 패치가 취약점을 방어하는지, 부작용은 없는지 비판적 교차 검증 수행

## 2. 비용 예측 (Cost Estimation) 추가

- **구현 방식**: `planning_node.py` 단계에서 파일의 글자 수(Length)를 기반으로 예상 토큰 수를 계산(`글자 수 / 4 ≈ 토큰 수`)하여 `estimated_cost_usd` 산출.
- **특징**: API 호출이 발생하지 않아 지연 시간과 비용이 0원. 승인 대기 상태(HITL 게이트웨이) 전에 프론트엔드에 예상 비용을 제공 가능.

## 3. 다중 모델 교차 검증 (Cross-Model Validation)

- **검증 대상**: SAST 탐지 단계가 아닌, 비용 효율성과 검증 효과가 가장 뛰어난 **패치 코드(Diff) 검토 단계**에 다중 모델 교차 검증 적용. (결정 사항)
- **구현 방식**: `patch_node`에서 생성된 패치(Diff)를 새로운 노드인 `review_patch_node`로 전달. 이 리뷰 노드는 다른 모델(예: Gemini)을 호출하여 패치를 검증. 전체 코드를 보내지 않으므로 토큰 비용이 매우 저렴.

## 4. CTI 확장을 위한 상태(State) 리팩토링 방식

- **결정 사항**: 기존 구조를 갈아엎지 않고, **상속을 통한 확장(Composition/Inheritance)** 방식으로 리팩토링 진행.
- **아키텍처적 이점**:
  - 개방-폐쇄 원칙(OCP) 준수: 기존 Security Audit 로직의 안정성을 유지하며 CTI 기능을 추가.
  - 관심사 분리(SoC): 세션 ID, 토큰 사용량 등은 `BaseState`에 두고, 도메인 특화 데이터는 각각 `SecurityAuditState`, `CtiResearchState`로 분리 보관.
- **구현 방식**: `agent_state.py` 내의 단일 `AgentState`를 `BaseState`와 `SecurityAuditState(BaseState)`로 분리.

---

## 변경 예정 파일 명세 (Proposed Changes)

1. **State Refactoring & Persona System**
   - `[MODIFY] apps/ai_engine/agent/agent_state.py`: `BaseState`, `SecurityAuditState` 도입 및 상태 필드 추가 (`estimated_cost_usd`, `dast_scenarios`, `patch_reviews`).
   - `[NEW] apps/ai_engine/agent/prompts/persona_loader.py`: 마크다운 페르소나 프롬프트 로더.
   - `[NEW] apps/ai_engine/agent/prompts/personas/*.md`: 4종의 페르소나 정의 파일 생성.

2. **Workflow Nodes Update**
   - `[MODIFY] apps/ai_engine/agent/nodes/planning_node.py`: Security Architect 페르소나, 비용 예측, DAST 시나리오 요약 로직 추가.
   - `[MODIFY] apps/ai_engine/agent/claude_client.py`: Vulnerability Analyst 페르소나 적용.
   - `[MODIFY] apps/ai_engine/agent/nodes/patch_node.py`: Remediation Engineer 페르소나 적용.
   - `[NEW] apps/ai_engine/agent/nodes/review_patch_node.py`: Security QA 페르소나를 활용한 패치 교차 검증(Gemini 등 타 모델 호출) 로직.
   - `[MODIFY] apps/ai_engine/agent/graph_builder.py`: `review_patch_node`를 노드 체인에 추가 (`patch_node` → `review_patch_node`).
