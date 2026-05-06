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
... (rest of the file)
