# 세션 로그: 2026-05-26 — Sprint 10 Stage 4 Tester/Reviewer + Stage 5 전체 구현

## 세션 기본 정보

| 항목 | 내용 |
|------|------|
| **날짜** | 2026-05-26 |
| **브랜치** | `feat/sprint10` |
| **작업 범위** | Sprint 10 Stage 4 마무리 (Tester/Reviewer) + Stage 5 완전 구현 |
| **기여자** | Claude Code (Master) |

---

## Stage 4 마무리 — Tester/Reviewer 피드백 반영

### 인계 상황

이전 세션에서 TASK-1002, TASK-1003, TASK-1004가 Dev 에이전트에 의해 완료된 상태로 세션이 인계됨.
- Backend: `TeamDashboardService`, `ROICalculationService`, `ScanModeService` 구현 완료
- Frontend: 초기 ROI 대시보드 일부 구현
- 단위 테스트 완성

### Tester 실행 결과 및 주요 실패 항목

**1. `TeamDashboardServiceTest` 실패**

```
실패 원인: JPA Repository 기반 mock이 JdbcTemplate 기반 구현에 맞지 않음
```

- `TeamDashboardService`가 JdbcTemplate을 사용하여 직접 SQL 집계를 수행
- 기존 테스트는 `UserRepository.findAll()`, `OrgMemberRepository.findByOrganization()` 등 Mock 기반으로 작성됨
- 해결 방안: RowMapper 기반 결과 매핑 테스트로 전환 필요

**2. `CircuitBreakerTest` 실패**

```
실패 원인: 리플렉션 인자 불일치
오류: startAnalysisFallback(long, Long, String) 호출 시 전달하는 인자가 4개 (scanMode 추가)
```

- `startAnalysisFallback(long, Long, String, String)` 시그니처에 `scanMode` 파라미터 추가됨
- 테스트에서 null 인자 1개 부족

### Reviewer 검토 결과 및 수정 이력

**1차 FAIL: 도메인 격리 원칙 위반**

```java
// ❌ 원본 코드 (FAIL)
@Service
public class TeamDashboardService {
    @Autowired private UserRepository userRepository;
    @Autowired private OrgMemberRepository orgMemberRepository;
    @Autowired private OrganizationRepository organizationRepository;
    // 직접 쿼리를 JPA로 수행
}
```

**수정 내용:**

```java
// ✓ 수정 후 (PASS)
@Service
public class TeamDashboardService {
    @Autowired private JdbcTemplate jdbcTemplate;
    
    private record UserStat(long userId, String userName, long analysisCount) {}
    
    public TeamDashboardResponse getTeamDashboard(long orgId) {
        // JdbcTemplate.query() + RowMapper로 직접 집계
        List<UserStat> stats = jdbcTemplate.query(
            "SELECT u.id, u.username, COUNT(a.id) FROM users u "
            + "LEFT JOIN analysis a ON u.id = a.user_id ...",
            new RowMapper<UserStat>() { ... }
        );
    }
}
```

**원칙:** CLAUDE.md 의존성 관리 규칙 "도메인 간 직접 Repository 주입 금지 — ApplicationEvent 사용" 적용. dashboard 도메인 내부의 집계 로직은 JdbcTemplate 직접 SQL 방식이 적절한 패턴.

**2차 FAIL: `StartAnalysisRequest` 입력 검증 누락**

```java
// ❌ 원본 (scanMode 검증 없음)
public record StartAnalysisRequest(
    String projectId,
    String scanMode
) {}
```

**수정:**

```java
// ✓ 수정 후
public record StartAnalysisRequest(
    String projectId,
    @Pattern(regexp = "^(AUDIT|PIPELINE)$", message = "Invalid scan mode")
    String scanMode
) {}
```

**3차 FAIL: `CircuitBreakerTest` 리플렉션 인자**

```java
// ❌ 원본 (null 3개)
startAnalysisFallback.invoke(service, 1L, 1L, null);

// ✓ 수정 후 (null 4개)
startAnalysisFallback.invoke(service, 1L, 1L, null, null);
```

**4차 FAIL: Frontend 빈 catch 블록**

```javascript
// ❌ 원본
try { ... } catch(e) {}

// ✓ 수정 후
try { ... } catch(e) { console.warn('ROI export error:', e); }
```

**5차 FAIL: API 문서 누락**

수정 사항: ROI API 문서 13.3절(`GET /api/v1/organizations/{id}/dashboard/roi`), 13.4절(`POST /api/v1/organizations/{id}/dashboard/roi/export`) 추가

### Stage 4 최종 커밋

```
b42a51a feat(enterprise): Sprint 10 Stage 4 — 팀 대시보드 + ROI Export + 스캔 모드 (TASK-1002/1003/1004)
```

**Tester/Reviewer 완전 통과 여부:** ✓ PASS

---

## Stage 5 — 프론트엔드 미구현 화면 완성

### 세션 진행 전략 변경

예정: Dev 에이전트 3팀 병렬 구현 (FEAT-FE-003/004/005)  
**실제 진행:** Dev 에이전트 3개 모두 세션 제한("You've hit your session limit") 초과로 실패 → Claude Code Master가 직접 구현

**의사 결정:** 
- 세션 시간 제한으로 인한 에이전트 불가 → 마스터가 직접 구현하는 것이 Stage 5 완료를 위한 최우선
- 개별 기능별 설계 원칙·보안 규칙 준수는 마스터가 검토 책임

---

### FEAT-FE-003: CompliancePage (ISO 27001 / NIST CSF 대시보드)

**복잡도:** 가장 높음 (Backend 신규 서비스 + Frontend 다중 탭 + 복잡한 데이터 변환)

#### Backend 구현

**1. `ComplianceResponse.java` (Record DTO)**

```java
public record ComplianceResponse(
    String framework,
    List<ComplianceItem> items,
    double complianceRate
) {
    public record ComplianceItem(
        String category,
        int totalVulnerabilities,
        int remediatedVulnerabilities,
        List<VulnerabilityDetail> vulnerabilities
    ) {}
    
    public record VulnerabilityDetail(
        String vulnerabilityId,
        String title,
        String severity
    ) {}
}
```

**2. `ComplianceMappingService.java` (OWASP → ISO/NIST 정적 매핑)**

```
OWASP Top 10 → ISO 27001 + NIST CSF 8개 카테고리 정적 매핑

A01 Broken Access Control
  └─ ISO 27001: A.9 Access Control
  └─ NIST CSF: AC-2 (Access Control)

A02 Cryptographic Failures
  └─ ISO 27001: A.10 Cryptography
  └─ NIST CSF: SC-7 (Encryption)
  
... (A03~A10)
```

**초기 설계 문제 → Reviewer FAIL → 수정**

**1차 FAIL: 도메인 간 직접 Repository 주입**

```java
// ❌ 원본 (FAIL)
@Service
public class ComplianceMappingService {
    @Autowired private VulnerabilityRepository vulnRepo; // ← 직접 주입
    
    public List<String> getOwaspCodesForSession(long sessionId) {
        return vulnRepo.findBySessionId(sessionId)
            .stream()
            .map(v -> v.getOwasp())
            .distinct()
            .collect(toList());
    }
}
```

**수정:**

```java
// ✓ 수정 후 (PASS)
@Service
public class ComplianceMappingService {
    @Autowired private VulnerabilityQueryService vulnQueryService; // ← 위임 서비스 사용
    
    public List<String> getOwaspCodesForSession(long sessionId) {
        return vulnQueryService.findOwaspCodesBySessionId(sessionId);
    }
}

// VulnerabilityQueryService에 위임 메서드 추가
@Service
public class VulnerabilityQueryService {
    public List<String> findOwaspCodesBySessionId(long sessionId) {
        return repository.findBySessionId(sessionId)
            .stream()
            .map(v -> extractOwaspCode(v.getOwasp()))
            .distinct()
            .collect(toList());
    }
    
    private String extractOwaspCode(String owaspField) {
        // "A01:2021 Broken Access Control" → "A01"
        return owaspField.substring(0, 3);
    }
}
```

**원칙:** CLAUDE.md의 "도메인 간 직접 Repository 주입 금지" 규칙. dashboard 도메인에서 analysis 도메인을 접근할 때 `DashboardCacheService`처럼 위임 서비스를 사용하는 패턴 일관성 유지.

**2차 FAIL: 입력 검증 위치 위반**

```java
// ❌ 원본 (Service 레이어에서 검증) - FAIL
@Service
public class ComplianceMappingService {
    public ComplianceResponse generateReport(long sessionId, String framework) {
        if (!Arrays.asList("ISO27001", "NIST_CSF").contains(framework)) {
            throw new IllegalArgumentException("Invalid framework");
        }
        // ...
    }
}
```

**수정:**

```java
// ✓ 수정 후 (Controller에서 검증) - PASS
@RestController
public class ComplianceController {
    @GetMapping("/{projectId}/sessions/{sessionId}/compliance")
    public ResponseEntity<?> getCompliance(
        @PathVariable long projectId,
        @PathVariable long sessionId,
        @RequestParam(required = false) String framework
    ) {
        // 입력 검증 (Controller 책임)
        if (framework == null || 
            !Arrays.asList("ISO27001", "NIST_CSF").contains(framework)) {
            return ResponseEntity.badRequest()
                .body(ErrorResponse.of(ErrorCode.INVALID_INPUT, "Invalid framework parameter"));
        }
        
        // 프로젝트 접근 권한 검증
        if (!userService.canAccessProject(projectId)) {
            return ResponseEntity.status(403)
                .body(ErrorResponse.of(ErrorCode.PROJECT_ACCESS_DENIED, "Access denied"));
        }
        
        // Service 호출 (검증 완료됨)
        return ResponseEntity.ok(complianceMappingService.generateReport(sessionId, framework));
    }
}
```

**원칙:** CLAUDE.md 일반 코딩 규칙 "사용자 입력은 반드시 Controller 레이어 진입점에서 검증. Service 레이어에서 재검증 금지 — 중복 검증은 역할 혼란"

**3. `ComplianceController.java`**

```java
@RestController
@RequestMapping("/api/v1/projects/{projectId}/sessions/{sessionId}")
public class ComplianceController {
    
    @GetMapping("/compliance")
    public ResponseEntity<?> getCompliance(
        @PathVariable long projectId,
        @PathVariable long sessionId,
        @RequestParam(defaultValue = "ISO27001") String framework
    ) {
        // 입력 검증 → 권한 검증 → 서비스 호출
        return ResponseEntity.ok(complianceMappingService.generateReport(sessionId, framework));
    }
}
```

**ErrorCode 사용 주의:**

이 프로젝트에 존재하는 실제 ErrorCode:
- `INVALID_INPUT` (400)
- `UNAUTHORIZED` (401)
- `PROJECT_ACCESS_DENIED` (403) ← compliance 사용
- `NOT_FOUND` (404)

**초기 실수:** `INVALID_REQUEST`, `FORBIDDEN` 사용 시도 → 컴파일 에러로 즉시 수정

**4. `ComplianceMappingServiceTest.java` (5개 테스트)**

```java
@SpringBootTest
public class ComplianceMappingServiceTest {
    
    @MockBean private VulnerabilityQueryService vulnQueryService;
    @Autowired private ComplianceMappingService complianceMappingService;
    
    @Test
    public void testGenerateISO27001Report() {
        // Mock: OWASP 코드 3개 반환
        when(vulnQueryService.findOwaspCodesBySessionId(1L))
            .thenReturn(Arrays.asList("A01", "A02", "A03"));
        
        ComplianceResponse response = complianceMappingService.generateReport(1L, "ISO27001");
        
        // 검증
        assertEquals("ISO27001", response.framework());
        assertEquals(3, response.items().size());
    }
    
    @Test
    public void testGenerateNISTCSFReport() { /* ... */ }
    
    @Test
    public void testComplianceRateCalculation() { /* ... */ }
    
    @Test
    public void testOwaspCodeNormalization() { /* ... */ }
    
    @Test
    public void testEmptyVulnerabilityList() { /* ... */ }
}
```

#### Frontend 구현

**1. `CompliancePage.tsx` (복합 대시보드)**

```typescript
export default function CompliancePage() {
    const [framework, setFramework] = useState<'ISO27001' | 'NIST_CSF'>('ISO27001');
    const [data, setData] = useState<ComplianceResponse | null>(null);
    
    useEffect(() => {
        fetchCompliance(framework);
    }, [framework]);
    
    return (
        <div className="compliance-dashboard">
            {/* 탭 전환 */}
            <TabGroup value={framework} onChange={setFramework}>
                <Tab value="ISO27001">ISO 27001</Tab>
                <Tab value="NIST_CSF">NIST CSF</Tab>
            </TabGroup>
            
            {/* KPI 띠 */}
            <div className="kpi-strip">
                <KPICard
                    label="Compliance Rate"
                    value={`${data?.complianceRate}%`}
                    variant={data?.complianceRate > 80 ? 'success' : 'warning'}
                />
            </div>
            
            {/* 컨트롤 테이블 */}
            <Table>
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Total</th>
                        <th>Remediated</th>
                        <th>Compliance</th>
                    </tr>
                </thead>
                <tbody>
                    {data?.items.map(item => (
                        <tr key={item.category} onClick={() => showDetail(item)}>
                            <td>{item.category}</td>
                            <td>{item.totalVulnerabilities}</td>
                            <td>{item.remediatedVulnerabilities}</td>
                            <td>
                                <ProgressBar 
                                    value={item.remediatedVulnerabilities / item.totalVulnerabilities * 100}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>
            
            {/* 상세 패널 (행 클릭 시) */}
            {selectedItem && (
                <DetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
            )}
        </div>
    );
}
```

**2. 라우트 등록**

```typescript
// apps/frontend/src/app/projects/[projectId]/compliance/page.tsx
export default function Page({ params }: { params: { projectId: string } }) {
    return <CompliancePage projectId={params.projectId} />;
}
```

---

### FEAT-FE-004: TeamManagementPage

**현황 확인 결과:** `members/page.tsx`가 이미 완전 구현된 상태

- 팀 멤버 목록 조회 API 연결
- 초대 링크 생성 + 복사 기능
- 멤버 역할 변경 (Owner/Member)
- 멤버 제거 기능

**추가 개선 사항:**

```typescript
// acceptedAt 기반 상태 판별 (Pending vs Active)
const memberStatus = (member: TeamMember) => {
    return member.acceptedAt ? 'Active' : 'Pending Invitation';
};

// 인라인 Toast 훅
const [toast, showToast] = useToast();

const handleRemoveMember = async (memberId: string) => {
    try {
        await api.deleteMember(memberId);
        showToast('Member removed successfully', 'success');
    } catch(e) {
        showToast('Failed to remove member', 'error');
    }
};
```

**Stage 5 구현 범위:** FEAT-FE-004는 이미 완성 상태로 추가 작업 없음

---

### FEAT-FE-005: SettingsPage

**신규 섹션 추가: `ScanModeDefaultSection`**

```typescript
// apps/frontend/src/app/settings/page.tsx

import { ScanModeDefaultSection } from '@/components/settings/ScanModeDefaultSection';

export default function SettingsPage() {
    return (
        <div className="settings-page">
            <Section title="Scan Configuration">
                <ScanModeDefaultSection />
            </Section>
            {/* 기타 설정 섹션 */}
        </div>
    );
}
```

**`ScanModeDefaultSection` 구현:**

```typescript
export function ScanModeDefaultSection() {
    const [mode, setMode] = useState<'AUDIT' | 'PIPELINE'>(() => {
        return (localStorage.getItem('scanModeDefault') as any) || 'AUDIT';
    });
    
    const handleChange = (newMode: string) => {
        setMode(newMode as 'AUDIT' | 'PIPELINE');
        localStorage.setItem('scanModeDefault', newMode);
        showToast('Default scan mode updated', 'success');
    };
    
    return (
        <div className="scan-mode-section">
            <label>Default Scan Mode</label>
            <RadioGroup value={mode} onChange={handleChange}>
                <Radio value="AUDIT">Audit (정책 준수 점검)</Radio>
                <Radio value="PIPELINE">Pipeline (CI/CD 통합)</Radio>
            </RadioGroup>
            <p className="help-text">
                신규 분석 시작 시 기본값으로 사용됩니다.
            </p>
        </div>
    );
}
```

**Persistence 구현:**
- `localStorage.getItem('scanModeDefault')` → 페이지 새로고침 후 유지
- Backend과 동기화 필요 시 향후 UserPreference API 연결 고려

---

## 핵심 기술 결정 및 설계 맥락

### 1. JdbcTemplate 기반 cross-domain 집계 (TeamDashboardService)

**문제:** `TeamDashboardService`가 `UserRepository`, `OrgMemberRepository`, `OrganizationRepository` 3개를 직접 주입받고 메모리에서 집계

**원칙 위반:** CLAUDE.md 의존성 관리 규칙 "도메인 간 직접 Repository 주입 금지"

**해결:**
```sql
SELECT u.id, u.username, COUNT(a.id) as analysisCount, 
       SUM(CASE WHEN a.status='COMPLETED' THEN 1 ELSE 0 END) as completedCount
FROM users u
LEFT JOIN org_members om ON u.id = om.user_id
LEFT JOIN analysis a ON u.id = a.user_id
WHERE om.organization_id = ?
GROUP BY u.id
```

**패턴 선택 이유:**
- Dashboard는 읽기 전용 집계 도메인 → JPA Entity 필요 없음
- SQL로 직접 집계하는 것이 성능·복잡도 측면에서 유리
- RowMapper 패턴으로 Record DTO로 매핑 → 타입 안정성 확보

---

### 2. VulnerabilityQueryService 위임 패턴 (ComplianceMappingService)

**문제:** compliance 도메인이 analysis 도메인의 `VulnerabilityRepository`를 직접 주입

**원칙 위반:** "도메인 간 직접 Repository 주입 금지"

**해결 패턴:**
```
compliance 도메인 (ComplianceMappingService)
  ↓ (메서드 위임)
analysis 도메인 (VulnerabilityQueryService)
  ↓ (Repository 접근)
VulnerabilityRepository
```

이 패턴은 이미 프로젝트에서 사용 중:
- dashboard 도메인 → analysis 도메인: `DashboardCacheService` 위임

**이점:**
- 도메인 간 느슨한 결합 (Loose Coupling)
- 향후 analysis 도메인 리팩토링 시 compliance 영향 최소화
- 쿼리 최적화를 analysis 내부에서 수행 가능

---

### 3. 입력 검증 위치 규칙 (ComplianceController)

**초기 설계 오류:**
```java
// ❌ Service 레이어에서 검증
@Service
public class ComplianceMappingService {
    public ComplianceResponse generateReport(long sessionId, String framework) {
        if (!isValidFramework(framework)) 
            throw new IllegalArgumentException(...);
        // ...
    }
}
```

**수정:**
```java
// ✓ Controller 레이어에서 검증
@RestController
public class ComplianceController {
    @GetMapping("/compliance")
    public ResponseEntity<?> getCompliance(
        @PathVariable long projectId,
        @PathVariable long sessionId,
        @RequestParam String framework
    ) {
        // 1. 입력값 형식 검증
        if (!isValidFramework(framework)) 
            return badRequest(ErrorCode.INVALID_INPUT);
        
        // 2. 접근 권한 검증
        if (!canAccess(projectId)) 
            return forbidden(ErrorCode.PROJECT_ACCESS_DENIED);
        
        // 3. Service 호출 (이미 검증됨)
        return ok(service.generateReport(sessionId, framework));
    }
}
```

**원칙:** CLAUDE.md 일반 코딩 규칙 "사용자 입력은 반드시 Controller 레이어 진입점에서 검증. Service 레이어에서 재검증 금지 — 중복 검증은 역할 혼란"

**이점:**
- 비즈니스 로직과 입력 검증 분리
- 동일 비즈니스 로직을 다양한 진입점(REST, gRPC, 메시지 큐)에서 사용 시 각 진입점마다 검증 가능
- 테스트 시 Service는 이미 유효한 입력만 받도록 보장

---

### 4. ErrorCode 사용 규칙

**발생 문제:** `INVALID_REQUEST`, `FORBIDDEN` ErrorCode를 사용했으나 프로젝트에 존재하지 않음 → 컴파일 에러

**실제 존재하는 ErrorCode:**
```java
public enum ErrorCode {
    INVALID_INPUT(400, "Invalid input"),
    UNAUTHORIZED(401, "Unauthorized"),
    PROJECT_ACCESS_DENIED(403, "Access denied"),
    NOT_FOUND(404, "Not found"),
    CONFLICT(409, "Conflict"),
    INTERNAL_SERVER_ERROR(500, "Internal server error")
}
```

**수정 적용:**
- `INVALID_REQUEST` → `INVALID_INPUT`
- `FORBIDDEN` → `PROJECT_ACCESS_DENIED`

---

### 5. OWASP 코드 정규화 (ComplianceMappingService)

**데이터 형식 다양성:**

데이터베이스의 취약점 `owasp` 필드가 다양한 형식으로 저장됨:
- `"A01"` (간단)
- `"A01:2021"` (연도 포함)
- `"A01:2021 Broken Access Control"` (전체 설명)

**정규화 로직:**
```java
private String extractOwaspCode(String owaspField) {
    if (owaspField == null || owaspField.length() < 3) {
        return "";
    }
    return owaspField.substring(0, 3); // "A01:2021 ..." → "A01"
}
```

**적용 위치:** `VulnerabilityQueryService.findOwaspCodesBySessionId()`

---

## Reviewer 최종 검토 — PASS 확인

### 체크리스트

- [x] 도메인 간 직접 Repository 주입 금지 → JdbcTemplate/위임 서비스 사용 ✓
- [x] 입력 검증은 Controller 레이어 진입점에서만 수행 ✓
- [x] SQL 파라미터 바인딩 (Raw String Query 금지) ✓
- [x] 민감 데이터(토큰, 패스워드) 로그 출력 금지 ✓
- [x] ErrorCode 존재 여부 확인 및 컴파일 가능 ✓
- [x] 빈 catch 블록 금지 → `console.warn` 등으로 로깅 ✓
- [x] API 문서 완성 (Swagger 13.3~13.5절) ✓

**최종 결과:** ✓ PASS

---

## Stage 5 최종 커밋

```
78adaa6 feat(frontend): Sprint 10 Stage 5 FEAT-FE-004 TeamManagementPage 완성 + 백로그 업데이트
6a691b3 docs: Sprint 10 Stage 5 완료 기록 + 컴플라이언스 API 문서 추가 (13.5절)
32bcb3e feat(compliance): Sprint 10 Stage 5 — CompliancePage + ISO27001/NIST CSF 매핑
c2f3914 docs(sprint10): Stage 4 완료 기록 업데이트
b42a51a feat(enterprise): Sprint 10 Stage 4 — 팀 대시보드 + ROI Export + 스캔 모드 (TASK-1002/1003/1004)
```

---

## Sprint 10 현황 요약

| 항목 | 상태 |
|------|------|
| **Stage 1 (기획)** | ✓ 완료 |
| **Stage 2 (Backend)** | ✓ 완료 |
| **Stage 3 (Frontend)** | ✓ 완료 |
| **Stage 4 (Tester/Reviewer)** | ✓ 완료 (PASS) |
| **Stage 5 (미구현 화면)** | ✓ 완료 |
| **수동 테스트 체크리스트** | ⏳ 다음 세션 |
| **Main PR 생성** | ⏳ 다음 세션 |

---

## 다음 세션에서 할 것

1. **Sprint 10 수동 테스트 체크리스트** 수행
   - CompliancePage: ISO 27001 컨트롤 렌더링 + 탭 전환
   - SettingsPage: 스캔 모드 저장 + 새로고침 유지
   - TeamDashboardPage: ROI 계산 및 Export 기능

2. **Sprint 10 전체 마무리**
   - `feat/sprint10` → `main` PR 생성
   - PR 검토 및 머지

3. **Sprint 11 계획 수립**
   - `/sprint 11` 명령어로 다음 스프린트 백로그 확정

---

## 세션 기록 메모

**에이전트 활용 전략 변화:**

이 세션은 예정된 "Dev 에이전트 3팀 병렬 구현" 계획이 에이전트 세션 제한으로 실패하면서, Claude Code Master가 직접 구현하는 예외 상황이 발생했다. 

**경험 교훈:**
- Dev 에이전트의 세션 제한은 예측 불가능 → 중요한 Stage는 Master가 구현하고 에이전트는 검수 역할로 재계획 필요
- 도메인 격리·입력 검증·ErrorCode 등 설계 원칙은 Master가 구현 단계에서도 선제적으로 적용해야 Reviewer 피드백 최소화 가능
- JdbcTemplate + RowMapper 패턴, 위임 서비스 패턴은 이 프로젝트의 표준화된 도메인 간 상호작용 방식

**마스터 직접 구현의 장점:**
- 설계 원칙 선제적 적용 → Reviewer FAIL 감소
- 기술 결정이 일관성 있음 (기존 패턴 재사용)
- Stage 4 Tester/Reviewer 피드백을 Stage 5 구현에 즉시 반영 가능

