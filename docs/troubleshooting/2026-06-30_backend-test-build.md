# 백엔드 테스트 빌드 깨짐 — SecurityDoc 시그니처 불일치

**날짜**: 2026-06-30
**브랜치**: `main`
**관련 커밋**: `7519ed8`

---

## 이슈 — SecurityDocService 시그니처 변경 후 테스트 미반영

### 증상

```bash
./gradlew compileTestJava
```

실패 (7 컴파일 에러):

```
error: method createRequest in class SecurityDocService cannot be applied to given types
  required: long, long, String, LocalDateTime
  found: long, long, String
```

전체 테스트 스위트가 main에서 RED 상태였음. FEAT-COMP-005 신규 백엔드 테스트도 실행 불가.

### 원인 분석

V063(framework_version 컬럼 추가, 2026-06-29 이전 커밋) 작업에서:

**프로덕션 코드 변경**:
```java
// Before
public void createRequest(long projectId, long userId, String docType) { ... }

// After (V063 반영)
public void createRequest(long projectId, long userId, String docType, LocalDateTime version) { ... }
```

**테스트 호출부는 미반영**:
- `SecurityDocControllerTest.java` 2곳
- `SecurityDocServiceTest.java` 5곳

이들이 여전히 구식 시그니처 `createRequest(projectId, userId, docType)` 호출 → 컴파일 에러 7건.

**근본 원인**:
1. 프로덕션 시그니처 변경 시 테스트 동반 검토 누락
2. CI/CD 게이트(`compileTestJava`과 test)가 실효성 부족했을 가능성 (실제로 이 상태가 오래 유지됨)

### 해결

테스트 호출부 7곳에 새로운 `version` 파라미터 추가:

```java
// SecurityDocControllerTest.java (line ~68)
securityDocService.createRequest(
    projectId,
    userId,
    "ISMS_P",
    LocalDateTime.now()  // version 추가
);

// SecurityDocServiceTest.java (line ~42, 78, 110, 145, 198 등)
securityDocService.createRequest(
    projectId,
    userId,
    docType,
    null  // 테스트는 null로 처리 (프로덕션 로직과 분리)
);
```

**빌드 확인**:
```bash
./gradlew compileTestJava
```
→ BUILD SUCCESSFUL

### 교훈 & 예방

1. **프로덕션 시그니처 변경 시**:
   - 모든 호출처 grep 수행 (테스트·다른 서비스·컨트롤러 포함)
   - 호출처 변경을 커밋 메시지에 명시

2. **테스트 게이트**:
   - CI에서 `compileTestJava` 반드시 실행 (현재 누락 가능성)
   - 병렬 세션에서 main에 직접 변경할 시 주의

3. **코드 리뷰**:
   - Reviewer가 시그니처 변경 시 호출처 전수 점검

### 관련 커밋

`7519ed8` fix(test): SecurityDocService.createRequest() 시그니처 변경 후 테스트 갱신(version 파라미터 추가)
