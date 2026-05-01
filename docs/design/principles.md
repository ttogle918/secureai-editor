# SecureAI CS 설계 원칙

> 모든 구현은 이 문서의 원칙을 준수해야 합니다.  
> CLAUDE.md 및 `.claude/skills/principles.md` 에서 참조합니다.

---

## 1. SOLID 원칙

### 1-1. Single Responsibility Principle (SRP) — 단일 책임 원칙

> 클래스/함수는 변경되는 이유가 단 하나여야 한다.

**적용 기준:**
- 하나의 Service 클래스는 하나의 도메인 개념(분석, 취약점, 리포트 등)만 담당
- "그리고(and)"가 들어가는 함수명은 분리 신호

**이 프로젝트에서의 적용:**
```java
// 잘못된 예: 분석 + 알림 + 리포트 생성 한 곳에
class AnalysisService {
    void runAndNotifyAndGenerateReport() { ... }
}

// 올바른 예: 각자의 책임
class AnalysisService { void run() { publish(new AnalysisCompletedEvent(...)); } }
class NotificationListener { @EventListener void onCompleted(AnalysisCompletedEvent e) { ... } }
class ReportService { void generate(Long sessionId) { ... } }
```

---

### 1-2. Open/Closed Principle (OCP) — 개방/폐쇄 원칙

> 확장에 열려 있고, 수정에 닫혀 있어야 한다.

**이 프로젝트에서의 적용:**
```python
# 잘못된 예: 새 언어 추가 시 기존 코드 수정
def parse_sbom(file, language):
    if language == "maven": ...
    elif language == "npm": ...      # 새 언어마다 여기 수정
    elif language == "cargo": ...

# 올바른 예: Strategy 패턴으로 확장
class SbomParserStrategy(Protocol):
    def parse(self, file: Path) -> List[Dependency]: ...

class MavenParser(SbomParserStrategy): ...
class NpmParser(SbomParserStrategy): ...
class CargoParser(SbomParserStrategy): ...  # 새 언어: 기존 코드 수정 없음
```

---

### 1-3. Liskov Substitution Principle (LSP) — 리스코프 치환 원칙

> 하위 타입은 상위 타입을 완전히 대체할 수 있어야 한다.

**이 프로젝트에서의 적용:**
```java
// ReportGenerator 추상 클래스를 상속하는 모든 구현체는
// 동일한 계약(generate 메서드 시그니처, null 반환 금지 등)을 지켜야 함
abstract class ReportGenerator {
    abstract byte[] generate(SessionReport report); // null 반환 금지
}

class PdfReportGenerator extends ReportGenerator { ... }   // 완전 대체 가능
class JsonReportGenerator extends ReportGenerator { ... }  // 완전 대체 가능
```

---

### 1-4. Interface Segregation Principle (ISP) — 인터페이스 분리 원칙

> 클라이언트가 사용하지 않는 메서드에 의존하지 않도록 인터페이스를 분리한다.

**이 프로젝트에서의 적용:**
```typescript
// 잘못된 예: 모든 분석 기능을 하나의 인터페이스에
interface AnalysisService {
  runSast(): void;
  runDast(): void;
  generateReport(): void;
  sendNotification(): void;
}

// 올바른 예: 역할별 분리
interface SastRunner { runSast(): Promise<SastResult>; }
interface DastRunner { runDast(): Promise<DastResult>; }
interface ReportGenerator { generateReport(sessionId: string): Promise<Report>; }
```

---

### 1-5. Dependency Inversion Principle (DIP) — 의존성 역전 원칙

> 고수준 모듈은 저수준 모듈에 의존하지 않는다. 둘 다 추상에 의존한다.

**이 프로젝트에서의 적용:**
```java
// 잘못된 예: 고수준 모듈이 구체 클래스에 의존
class AnalysisService {
    private final PassiveScanStrategy strategy = new PassiveScanStrategy(); // 구체 클래스
}

// 올바른 예: 인터페이스에 의존 (Spring DI로 주입)
class AnalysisService {
    private final ScanStrategy strategy; // 인터페이스
    AnalysisService(ScanStrategy strategy) { this.strategy = strategy; }
}
```

---

## 2. Composition over Inheritance — 상속보다 조합

> 기능 확장은 상속이 아닌 조합으로 구현한다.

**적용 기준:**
- 상속 계층 2단계 이상 → 조합으로 재설계 검토
- "is-a" 관계가 아닌 "has-a" 관계인 경우 반드시 조합

**이 프로젝트에서의 적용:**
```java
// 잘못된 예: 상속으로 기능 확장
class BasicPayloadGenerator { ... }
class SqlInjectionPayloadGenerator extends BasicPayloadGenerator { ... }
class XssPayloadGenerator extends BasicPayloadGenerator { ... }

// 올바른 예: Factory + 전략 조합
class PayloadGeneratorFactory {
    private final Map<VulnType, PayloadGenerator> generators;

    PayloadGeneratorFactory(List<PayloadGenerator> generators) {
        this.generators = generators.stream()
            .collect(toMap(PayloadGenerator::getType, identity()));
    }

    PayloadGenerator get(VulnType type) { return generators.get(type); }
}
```

---

## 3. 도메인 계층 규칙

```
[외부 요청]
    ↓
Controller     ← 입력 검증, DTO 변환, HTTP 상태 코드 결정
    ↓
Service        ← 비즈니스 로직, @Transactional 경계
    ↓
Repository     ← 데이터 접근, 쿼리
    ↓
Entity/DB

[도메인 간 통신]
Service → ApplicationEventPublisher.publishEvent()
                    ↓
         다른 도메인의 @EventListener
```

**절대 금지:**
- Controller에서 다른 도메인의 Repository 직접 주입
- Entity에서 Service 호출
- Repository에서 비즈니스 로직 처리

---

## 4. 적용된 아키텍처 패턴

### Strategy 패턴
**언제**: 알고리즘을 실행 시점에 교체해야 할 때  
**사용 위치**: `ScanStrategy` (Passive/Active/Continuous), `SbomParserStrategy`

### Factory 패턴
**언제**: 객체 생성 조건이 복잡하거나 생성 책임을 분리해야 할 때  
**사용 위치**: `PayloadGeneratorFactory` (취약점 유형별 페이로드 생성기)

### Template Method 패턴
**언제**: 알고리즘의 뼈대는 같고 구체 단계만 다를 때  
**사용 위치**: `ReportGenerator` → `PdfReportGenerator`, `JsonReportGenerator`

### Observer (Event-Driven)
**언제**: 도메인 간 느슨한 결합이 필요할 때  
**사용 위치**: `VulnerabilityFoundEvent` → `SessionAggregateListener`, `AuditLogListener`, `NotificationListener`

### Saga 패턴
**언제**: 여러 서비스에 걸친 분산 트랜잭션이 필요할 때  
**사용 위치**: LangGraph — SAST 노드 → DAST 노드 → Patch 노드 (실패 시 체크포인트에서 재개)

### Circuit Breaker
**언제**: 외부 서비스 장애가 전체 시스템으로 전파되는 것을 막을 때  
**사용 위치**: Backend → AI Engine HTTP 호출 (Resilience4j, 50% 실패율, 30s 대기)

### Bulkhead
**언제**: 특정 작업의 부하가 다른 작업에 영향을 주지 않도록 격리할 때  
**사용 위치**: Thread Pool 분리 — `analysisExecutor`, `dastExecutor`, `reportExecutor`, `emailExecutor`

### Decorator 패턴
**언제**: 투명하게 기능을 추가해야 할 때  
**사용 위치**: `AesEncryptionConverter` (JPA 컨버터, Entity 필드에 `@Convert` 선언으로 투명 적용)

---

## 5. 확장성 설계 원칙

### Strangler Fig (점진적 서비스 분리)
현재 모노레포 구조에서 필요 시 서비스를 독립적으로 분리 가능하도록 설계:
- 각 도메인 패키지는 독립적으로 배포 가능한 서비스로 추출 가능
- ApplicationEvent → 추후 메시지 브로커(Kafka)로 전환 용이

### 수평 확장
- 분석 세션은 `thread_id`로 격리 → 스테이트리스 확장 가능
- Redis 분산 락으로 중복 실행 방지
- PostgreSQL 파티셔닝 (`analysis_sessions` — 월별)

---

## 6. 코드 리뷰 체크리스트

구현 완료 후 자체 검토:

```
[ ] SRP: 이 클래스/함수의 변경 이유가 하나인가?
[ ] OCP: 새 기능 추가 시 기존 코드 수정 없이 확장 가능한가?
[ ] DIP: 구체 클래스가 아닌 인터페이스에 의존하는가?
[ ] CoI: 상속 대신 조합을 사용했는가?
[ ] 계층 규칙: Controller/Service/Repository 역할 분리가 올바른가?
[ ] 도메인 격리: 다른 도메인의 Repository를 직접 주입하지 않았는가?
[ ] 보안: 입력 검증이 Controller에서만 이루어지는가?
[ ] 보안: 민감 데이터가 로그에 노출되지 않는가?
[ ] 테스트: 단위 테스트가 변경된 로직을 커버하는가?
```
