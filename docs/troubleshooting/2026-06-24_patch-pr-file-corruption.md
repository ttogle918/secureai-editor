# 패치 PR이 파일을 손상시키는 문제 트러블슈팅

**날짜**: 2026-06-24
**브랜치**: `fix/sprint14-runtime-defects` (커밋 `cdd4820` → `5017ceb` --no-ff 머지)
**관련 커밋**: `cdd4820`, `5017ceb`

---

## 이슈 — 패치 PR 생성 시 대상 파일이 스니펫으로 손상될 위험

### 증상

**GitHub의 실 PR 생성 시** 대상 파일 전체가 `patchedSnippet`(취약 구간 수정본)으로 **완전히 치환**되는 위험.

예시:
- 원본 파일: `src/UserController.java` (300줄)
- 취약 구간(originalSnippet): 15~20줄 (SQL injection)
- patchedSnippet: 6줄 (수정본)

**결과** (버그): PR이 생성되는 파일 전체 내용이 6줄로 축약됨 → 파일 손상

**단위테스트 미검출 이유**: `PatchPrServiceTest`는 mock GitHub을 사용하므로, 실 GitHub API 호출(putFileContents)이 일어나지 않음. 따라서 파일 조작의 위험성이 테스트에서 드러나지 않음.

---

## 원인 분석

### 설계 의도 vs 구현 괴리

**설계 의도**:
- `patched_snippet`: AI가 생성한 "취약 구간만 수정한 코드"
- PR에 포함되어야 할 것: 전체 파일 중 originalSnippet 구간을 patchedSnippet으로 치환한 **완성된 파일**

**구현 버그**:
```java
// ❌ 버그: patchedSnippet을 파일 전체로 덮어씀
putFileContents(
    repo, file, branch,
    patchedSnippet,  // 이건 "스니펫"인데 전체 파일로 취급됨
    message
)
```

### 근본 원인

`PatchPrService.buildPatch()`:
1. AI가 patchedSnippet 반환
2. **originalSnippet 구간 확인 안 함**
3. 바로 `putFileContents`로 커밋
4. 원본 파일의 나머지 코드는 버려짐

---

## 해결

### 1. 안전한 파일 재구성 로직

**신규 메서드**: `PatchPrService.buildPatchedFileContent()`
```java
/**
 * 원본 파일의 originalSnippet 구간을 patchedSnippet으로 치환해 전체 파일 재구성
 * 
 * @param originalFileContent 원본 파일 전체 내용
 * @param originalSnippet 원본 취약 구간
 * @param patchedSnippet 수정된 구간
 * @return 재구성된 전체 파일
 * @throws IllegalArgumentException 치환 불가능 시 (originalSnippet 미발견, 중복 등)
 */
public String buildPatchedFileContent(
    String originalFileContent,
    String originalSnippet,
    String patchedSnippet
) {
    // 1. originalSnippet이 정확히 1회만 존재하는지 확인
    int occurrences = countOccurrences(originalFileContent, originalSnippet);
    if (occurrences == 0) {
        throw new IllegalArgumentException(
            "originalSnippet not found in file"
        );
    }
    if (occurrences > 1) {
        throw new IllegalArgumentException(
            "originalSnippet appears multiple times; ambiguous replacement"
        );
    }
    
    // 2. 안전하게 치환
    return originalFileContent.replace(originalSnippet, patchedSnippet);
}

private int countOccurrences(String text, String pattern) {
    return text.split(java.util.regex.Pattern.quote(pattern), -1).length - 1;
}
```

### 2. PR 생성 전 파일 내용 fetch

**수정된 flow** (`createPatchBranch()`):

```java
public CreatePatchBranchResponse createPatchBranch(
    CreatePatchBranchRequest req
) {
    // ... 필드 검증 ...
    
    // 1. 원본 파일 내용 fetch (GitHub API: GET /repos/{owner}/{repo}/contents/{path})
    String originalFileContent = gitHubClient.getFileContent(
        req.getOwner(),
        req.getRepo(),
        req.getFilePath(),
        req.getBaseBranch()
    );
    
    // 2. originalSnippet + patchedSnippet로 전체 파일 재구성
    String patchedFileContent = buildPatchedFileContent(
        originalFileContent,
        req.getOriginalSnippet(),
        req.getPatchedSnippet()
    );
    // ⚠️ 재구성 실패 → 422 ErrorCode.PATCH_CONTENT_UNAVAILABLE
    // → 고아 브랜치 생성 방지
    
    // 3. 패치 브랜치 생성 및 커밋 (재구성된 파일로)
    String branchName = createPatchBranch(req);
    commitFile(
        req.getOwner(),
        req.getRepo(),
        branchName,
        req.getFilePath(),
        patchedFileContent,  // ✅ 전체 파일
        commitMessage
    );
    
    return response(branchName);
}
```

### 3. GitHub API: 파일 내용 조회

**신규 메서드**: `GitHubRestClient.getFileContent()`

```java
/**
 * GitHub REST API: GET /repos/{owner}/{repo}/contents/{path}
 * 파일 내용을 base64 디코딩해 반환.
 * 
 * @return 파일 전체 내용 (String)
 * @throws NotFoundException (404) 파일 미존재
 */
public String getFileContent(
    String owner,
    String repo,
    String filePath,
    String branch
) {
    String url = String.format(
        "https://api.github.com/repos/%s/%s/contents/%s?ref=%s",
        owner, repo, filePath, branch
    );
    
    try {
        HttpResponse<String> response = httpClient.send(
            HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "token " + token)
                .build(),
            HttpResponse.BodyHandlers.ofString()
        );
        
        if (response.statusCode() == 404) {
            return null;  // 파일 없음 → caller가 처리
        }
        
        if (response.statusCode() != 200) {
            throw new RuntimeException(
                "GitHub API error: " + response.statusCode()
            );
        }
        
        // JSON: { "content": "<base64>" }
        JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
        String base64Content = json.get("content").getAsString();
        
        // base64 디코딩
        byte[] decoded = Base64.getDecoder().decode(base64Content);
        return new String(decoded, StandardCharsets.UTF_8);
        
    } catch (IOException | InterruptedException e) {
        throw new RuntimeException("GitHub API call failed", e);
    }
}
```

### 4. 에러 코드 추가

**`ErrorCode.java`**:
```java
public enum ErrorCode {
    // ...
    PATCH_CONTENT_UNAVAILABLE(
        422,
        "Patch content unavailable: originalSnippet not found or ambiguous"
    ),
    // ...
}
```

### 5. 고아 브랜치 방지

**중요**: 재구성 로직이 파일 수정 **전에** 실행되어야 함.
- ✅ 재구성 성공 → 브랜치/커밋 생성
- ❌ 재구성 실패 (422) → 브랜치 미생성 → 고아 방지

```java
// createPatchBranch() 내:
try {
    String patchedFileContent = buildPatchedFileContent(...);  // 먼저
} catch (IllegalArgumentException e) {
    return ErrorResponse.of(ErrorCode.PATCH_CONTENT_UNAVAILABLE);
}

// 이후 브랜치 생성
String branchName = createPatchBranch(...);
commitFile(..., patchedFileContent);
```

---

## 재현 및 검증

### 단위테스트

**`PatchPrServiceTest.java`**:

```java
@Test
void testBuildPatchedFileContent_success() {
    String original = "public void login() {\n" +
                      "  String sql = \"SELECT * FROM users WHERE id=\" + id;\n" +
                      "  db.execute(sql);\n" +
                      "}";
    String originalSnippet = "String sql = \"SELECT * FROM users WHERE id=\" + id;";
    String patchedSnippet = "String sql = \"SELECT * FROM users WHERE id=?\"; PreparedStatement stmt = db.prepare(sql);";
    
    String result = service.buildPatchedFileContent(original, originalSnippet, patchedSnippet);
    
    assertThat(result).contains("PreparedStatement stmt");
    assertThat(result).contains("public void login");
    assertThat(result).doesNotContain("+ id");
}

@Test
void testBuildPatchedFileContent_snippetNotFound() {
    String original = "public void login() { ... }";
    String originalSnippet = "NOT_EXIST";
    String patchedSnippet = "PATCHED";
    
    assertThrows(
        IllegalArgumentException.class,
        () -> service.buildPatchedFileContent(original, originalSnippet, patchedSnippet)
    );
}

@Test
void testBuildPatchedFileContent_ambiguous() {
    String original = "if (x) { y(); } if (x) { z(); }";
    String originalSnippet = "if (x)";
    String patchedSnippet = "if (x && safe)";
    
    assertThrows(
        IllegalArgumentException.class,
        () -> service.buildPatchedFileContent(original, originalSnippet, patchedSnippet)
    );
}

@Test
void testCreatePatchBranch_422_snippetNotFound() {
    CreatePatchBranchRequest req = new CreatePatchBranchRequest(
        "secureai", "vulnerable-app", "src/Main.java",
        "main",
        "NOTFOUND", "PATCHED"
    );
    
    when(gitHubClient.getFileContent(...))
        .thenReturn("public class Main { }");
    
    assertThatThrownBy(() -> service.createPatchBranch(req))
        .isInstanceOf(ErrorResponseException.class)
        .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PATCH_CONTENT_UNAVAILABLE);
    
    // ✅ 브랜치 미생성 (고아 방지)
    verify(gitHubClient, never()).createBranch(...);
}
```

### 통합테스트 (선택사항)

실 GitHub mock으로 전체 flow 검증:
```bash
cd apps/backend
./gradlew test -k PatchPrServiceTest
```

---

## 프로덕션 체크리스트

- [ ] `secureai-patch-verify` 이미지 빌드 및 레지스트리 푸시
- [ ] `getFileContent()` 404 처리 주석 추가 (Reviewer 권고)
- [ ] 벌크 패치 요청(여러 파일) 시에도 각 파일 독립 검증
- [ ] 고객 FAQ: "왜 originalSnippet이 정확해야 하나?" → 파일 손상 방지
