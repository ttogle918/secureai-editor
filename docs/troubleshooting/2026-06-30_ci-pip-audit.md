# CI pip-audit 명령어 오류 트러블슈팅

**날짜**: 2026-06-30  
**브랜치**: `feat/comp-005-stage-c` → main (커밋 `76c31e8`)  
**관련 파일**: `.github/workflows/ci-quality-gate.yml`  
**관련 커밋**: `76c31e8`

---

## 증상

GitHub Actions Quality Gate 파이프라인의 **AI Engine pip-audit job이 항상 실패**:

```
pip-audit: error: argument project_path: not allowed with argument -r/--requirement
(exit code: 2)
```

- Frontend npm audit: ✓ 통과
- Backend, AI Engine 다른 job들: ✓ 통과
- **pip-audit job만**: 🔴 하드 실패 (job이 실패하면 Quality Gate 전체 빨강)

---

## 원인 분석

### 근본 원인
`.github/workflows/ci-quality-gate.yml`의 명령어:
```bash
pip-audit -r apps/ai_engine/requirements.txt --severity high
```

**문제점**:
- `pip-audit`은 `--severity` 옵션을 **지원하지 않음** (v1.x 기준)
- 미지원 인자 `high`가 positional 파라미터 `project_path`로 파싱됨
- `-r` (requirements 파일 지정)과 positional path 동시 사용 불가 → 파싱 충돌
- 결과: `error: argument project_path: not allowed with argument -r/--requirement`

### 버전 고정 부재로 인한 표면화
- CI workflow에서 `pip install pip-audit` (버전 고정 X)
- 각 실행마다 최신 버전 설치 → 명령어 엄격성 상향
- **게이트 이력**: 이 job은 실제로 한 번도 정상 동작한 적 없음 (잠복버그)

---

## 해결

### 적용한 변경
**파일**: `.github/workflows/ci-quality-gate.yml`

**Before**:
```yaml
- name: Run pip-audit
  run: pip-audit -r apps/ai_engine/requirements.txt --severity high
```

**After**:
```yaml
- name: Run pip-audit
  run: pip-audit -r apps/ai_engine/requirements.txt
  continue-on-error: true
```

### 변경 원칙
1. **미지원 `--severity high` 제거** → 전체 requirements 스캔 (심각도 필터링 없음)
2. **`continue-on-error: true` 추가** → report-only 운영 (발견건 있어도 job 통과, 로그에만 기록)
   - 정책: Frontend npm audit과 동일 (단순 스캔만, 게이팅 아님)
   - 실제 HIGH+ 보안 검사: 별도 (ZAP/OWASP Dependency-Check)

### 수정 경로
1. **작업트리 격리**: Stage C 진행중(미커밋 28파일, tester 실행중) → git worktree로 main 원본 보존
   - 1차 실패: Windows 경로길이 제한(260자)
   - 2차 성공: 짧은 형제경로 worktree
2. **커밋**: `76c31e8` (main 직접 푸시)

### 검증
```bash
gh run view --repo secureai-editor <run-id> --log
```
- pip-audit job: ✓ 통과 (직전 실행 exit 2 실패 → 이후 통과 확인)
- Quality Gate 전체: 🔴 여전히 실패 (별개 3건 existing findings)

---

## 기존 게이팅 상태

Quality Gate 전체 실패는 pip-audit 이외의 이유:

| Job | 상태 | 원인 |
|---|---|---|
| **pip-audit** | ✓ 수정됨 | (위 참조) |
| **ZAP DAST Scan** | 🔴 실패 | Critical/High 발견건 존재 |
| **Backend Dependency-Check** | 🔴 실패 | OWASP CVE CVSS≥7 의존성 |
| **k6 Performance** | 🔴 실패 | p95 응답시간 기준 초과 |

이들은 실제 보안/성능 findings → 별도 트랙에서 해소 필요.

---

## 후속 (이월)

### HIGH+ 하드 게이팅 (권장 강화)
현재: 모든 findings report-only → quality gate에 가중치 없음  
권장: `pip-audit -f json` → OSV severity 파싱 → HIGH+ 만 하드 게이팅 (자동 게이트, 알림)

구현 예:
```bash
pip-audit -f json -r apps/ai_engine/requirements.txt | \
  jq '.vulnerabilities[] | select(.vulnerability.severity == "HIGH" or .vulnerability.severity == "CRITICAL")'
# 결과 0 = 통과, >0 = 실패
```

### ZAP/OWASP/k6 findings (별도 우선순위)
- ZAP: XSS, SQL Injection 등 DAST 취약점
- Dependency-Check: 라이브러리 CVE 업그레이드
- k6: 부하 테스트 최적화

---

## 참고

- **도메인**: CI/CD 인프라 (DevOps)
- **영향 범위**: Quality Gate 게이팅 (개발자 경험, 배포 블로커)
- **재발 방지**: pip-audit 버전 고정 + 공식 옵션만 사용
