# ☕ STACK_java_spring — Java Spring Boot 특화 보안 패턴
## RAG 추가 대상 | 로드 조건: .java + springframework 감지 시

---

## 1️⃣ Spring Boot 즉시 CRITICAL

```java
// ── SQL Injection ─────────────────────────────────────
String sql = "SELECT * FROM users WHERE id = '" + userId + "'";
Statement stmt = conn.createStatement();
stmt.executeQuery(sql);

String jpql = "FROM User WHERE username = '" + username + "'";
em.createQuery(jpql).getResultList();

@Query("SELECT u FROM User u WHERE u.name = '" + name + "'")
// ↑ @Query 어노테이션에 문자열 연결 → JPQL Injection

// ── Command Injection ─────────────────────────────────
Runtime.getRuntime().exec("ping " + host);
new ProcessBuilder("sh", "-c", userInput).start();

// ── Java 역직렬화 (RCE) ────────────────────────────────
ObjectInputStream ois = new ObjectInputStream(userInputStream);
Object obj = ois.readObject();    // 가젯 체인으로 RCE 가능

// ── Spring Security 완전 비활성화 ────────────────────
@SpringBootApplication(exclude = {SecurityAutoConfiguration.class})

http.csrf().disable();            // CSRF 전체 비활성화
http.authorizeRequests().anyRequest().permitAll();  // 모든 요청 허용

// ── 하드코딩 자격증명 ────────────────────────────────
spring.datasource.password=admin123   # application.properties
spring.datasource.url=jdbc:mysql://db:3306/prod?user=root&password=root
```

---

## 2️⃣ Spring Boot 즉시 HIGH

```java
// ── @PreAuthorize 누락 ────────────────────────────────
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    // 클래스 레벨 보안 없음

    @DeleteMapping("/users/{id}")
    public void deleteUser(@PathVariable Long id) {
        userService.delete(id);    // 인가 검증 없음
    }
}

// ── IDOR — 소유권 검증 없음 ──────────────────────────
@GetMapping("/api/orders/{orderId}")
public Order getOrder(@PathVariable Long orderId,
                      @AuthenticationPrincipal UserDetails user) {
    return orderRepo.findById(orderId).orElseThrow();
    // user.getUsername()과 order.userId 비교 없음
}

// ── Mass Assignment — @RequestBody를 Entity에 직접 바인딩 ─
@PutMapping("/api/users/{id}")
public User updateUser(@PathVariable Long id,
                       @RequestBody User user) {  // Entity 직접 바인딩
    // user.isAdmin() = true 가능, user.role = "ADMIN" 가능
    return userRepo.save(user);
}

// ── Actuator 전체 노출 ────────────────────────────────
# application.properties
management.endpoints.web.exposure.include=*    # 전체 노출
management.endpoint.env.enabled=true           # 환경변수 노출
management.endpoint.heapdump.enabled=true      # 힙 덤프 노출

// ── XXE (XML 파서 기본 설정) ─────────────────────────
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
// 외부 엔티티 비활성화 없음
DocumentBuilder db = dbf.newDocumentBuilder();
Document doc = db.parse(userXmlInput);

// ── MD5 비밀번호 해시 ────────────────────────────────
MessageDigest md = MessageDigest.getInstance("MD5");
String hash = new String(md.digest(password.getBytes()));

// ── RestTemplate SSRF ────────────────────────────────
@PostMapping("/fetch")
public String fetchUrl(@RequestParam String url) {
    return restTemplate.getForObject(url, String.class);
}
```

---

## 3️⃣ Spring Boot 확인 필요 패턴

```java
// @Transactional 없는 다중 DB 업데이트
public void transferMoney(Long from, Long to, BigDecimal amount) {
    // @Transactional 없음 → 부분 실패 시 데이터 불일치
    accountRepo.debit(from, amount);
    accountRepo.credit(to, amount);  // 여기서 실패해도 debit은 완료됨
}

// Spring Data JPA 메서드 — 파라미터 확인
@Query("SELECT u FROM User u WHERE u.department = :dept")
List<User> findByDepartment(@Param("dept") String dept);
// ✅ Named Parameter면 안전

// Native Query 사용 시
@Query(value = "SELECT * FROM users WHERE id = ?1", nativeQuery = true)
// ✅ ?1 포지셔널 파라미터면 안전
// ❌ value = "SELECT * FROM users WHERE id = " + id 면 CRITICAL

// @Value 어노테이션으로 설정 주입
@Value("${app.api.key}")
private String apiKey;
// ✅ application.properties에서 읽으면 OK
// application.properties에 하드코딩됐는지 확인 필요
```

---

## 4️⃣ Spring Boot 올바른 패턴 (참조)

```java
// ✅ PreparedStatement
String sql = "SELECT * FROM users WHERE id = ?";
PreparedStatement pstmt = conn.prepareStatement(sql);
pstmt.setLong(1, userId);

// ✅ Spring Data JPA Named Parameter
@Query("SELECT u FROM User u WHERE u.username = :username")
Optional<User> findByUsername(@Param("username") String username);

// ✅ 메서드 네이밍 쿼리 (가장 안전)
Optional<User> findByUsernameAndStatus(String username, UserStatus status);

// ✅ @PreAuthorize 적용
@PreAuthorize("hasRole('ADMIN')")
@DeleteMapping("/api/admin/users/{id}")
public void deleteUser(@PathVariable Long id) { ... }

// ✅ IDOR 방지 — 소유권 검증
@GetMapping("/api/orders/{orderId}")
public Order getOrder(@PathVariable Long orderId,
                      @AuthenticationPrincipal UserDetails user) {
    return orderRepo.findByIdAndUsername(orderId, user.getUsername())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
}

// ✅ DTO 사용 — Entity 직접 바인딩 금지
public record UserUpdateRequest(
    @NotBlank @Size(max=50) String username,
    @Email String email
    // isAdmin, role 필드 없음
) {}

@PutMapping("/api/users/me")
public UserResponse updateMe(@Valid @RequestBody UserUpdateRequest req,
                              @AuthenticationPrincipal UserDetails user) { ... }

// ✅ Actuator 최소 노출
management.endpoints.web.exposure.include=health,info
management.endpoint.health.show-details=when-authorized

// ✅ XXE 방지
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

// ✅ 비밀번호 BCrypt
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);  // strength 12
}
```

---

## 5️⃣ Spring Boot 의존성 특이사항

```
Spring Boot < 3.2.x    → 정기 보안 패치 확인
spring-security < 6.x  → 구버전 인증 취약점
Log4j < 2.17.1         → Log4Shell (CVE-2021-44228) — 즉시 CRITICAL
Jackson < 2.14.x       → 역직렬화 가젯 체인 가능
XStream < 1.4.20       → XXE + RCE 가능
Spring Web < 5.3.x     → CVE-2022-22965 (Spring4Shell)
```
