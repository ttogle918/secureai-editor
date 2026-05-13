# 🗡️ B-01: SQL Injection (SQLi)
## AI 코드 분석 지침 — 공격 원리 · 탐지 패턴 · 수정 기준

> **AI 사용 지침:** 코드 분석 시 이 파일을 참조하여
> SQL Injection 패턴을 탐지하고 정확한 심각도와 수정 방법을 제시하세요.

---

## 📋 기본 정보

| 항목 | 내용 |
|------|------|
| OWASP | A03:2021 - Injection |
| CWE | CWE-89 (SQL Commands Injection) |
| CVSS 기본 | 7.5 ~ 9.8 (HIGH ~ CRITICAL) |
| 발생 빈도 | 매우 높음 (전체 웹 공격의 65% 이상) |
| 자동화 가능 | ✅ (sqlmap 등으로 완전 자동화 가능) |

---

## 1️⃣ 공격 원리

```
정상 요청:
  user_id = "42"
  query = "SELECT * FROM users WHERE id = '42'"
  → 의도된 동작

악의적 요청:
  user_id = "' OR '1'='1"
  query = "SELECT * FROM users WHERE id = '' OR '1'='1'"
  → WHERE 절이 항상 참 → 전체 테이블 반환

더 위험한 공격:
  user_id = "'; DROP TABLE users; --"
  → 테이블 삭제

  user_id = "' UNION SELECT username, password FROM admin --"
  → 관리자 테이블 조회
```

---

## 2️⃣ 취약 패턴 탐지 (AI 탐지 대상)

### Python 취약 패턴

```python
# ❌ 패턴 1: f-string 쿼리 조립 → CRITICAL
query = f"SELECT * FROM users WHERE id = '{user_id}'"
query = f"SELECT * FROM orders WHERE user = '{username}' AND status = '{status}'"

# ❌ 패턴 2: % 포맷팅 → CRITICAL
query = "SELECT * FROM users WHERE name = '%s'" % username
query = "DELETE FROM sessions WHERE token = '%s'" % token

# ❌ 패턴 3: + 연결 → CRITICAL
query = "SELECT * FROM products WHERE category = '" + category + "'"

# ❌ 패턴 4: .format() → CRITICAL
query = "UPDATE users SET email='{}' WHERE id={}".format(email, user_id)

# ❌ 패턴 5: execute()에 직접 사용자 입력 → HIGH
cursor.execute("SELECT * FROM users WHERE id = " + request.args.get('id'))

# ❌ 패턴 6: SQLAlchemy text()에 f-string → HIGH
from sqlalchemy import text
db.execute(text(f"SELECT * FROM users WHERE id = '{user_id}'"))

# ❌ 패턴 7: filter() 우회 시도 → HIGH
# 사용자가 컬럼명을 직접 지정하는 경우
order_col = request.args.get('sort')  # 검증 없음
query = f"SELECT * FROM items ORDER BY {order_col}"  # 컬럼 인젝션
```

### JavaScript/Node.js 취약 패턴

```javascript
// ❌ 패턴 1: 템플릿 리터럴 → CRITICAL
const query = `SELECT * FROM users WHERE id = '${userId}'`;
db.query(query);

// ❌ 패턴 2: 문자열 연결 → CRITICAL
const sql = "SELECT * FROM orders WHERE user_id = " + req.body.userId;

// ❌ 패턴 3: Knex.js raw() 오용 → HIGH
knex.raw(`SELECT * FROM users WHERE id = ${req.params.id}`);

// ❌ 패턴 4: TypeORM query() 직접 사용 → HIGH
connection.query(`SELECT * FROM user WHERE id = '${id}'`);
```

### Java Spring Boot 취약 패턴

```java
// ❌ 패턴 1: JDBC 문자열 연결 → CRITICAL
String sql = "SELECT * FROM users WHERE id = '" + userId + "'";
Statement stmt = conn.createStatement();
stmt.executeQuery(sql);

// ❌ 패턴 2: JPA JPQL 문자열 연결 → HIGH
String jpql = "FROM User WHERE username = '" + username + "'";
em.createQuery(jpql).getResultList();

// ❌ 패턴 3: @Query 어노테이션 + 문자열 연결 → HIGH
@Query("SELECT u FROM User u WHERE u.name = '" + name + "'")
```

---

## 3️⃣ 올바른 수정 패턴

### Python 수정

```python
# ✅ SQLAlchemy ORM (가장 안전)
user = db.query(User).filter(User.id == user_id).first()

# ✅ SQLAlchemy text() + 바인딩 파라미터
from sqlalchemy import text
result = db.execute(text("SELECT * FROM users WHERE id = :uid"), {"uid": user_id})

# ✅ psycopg2 파라미터 바인딩
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))

# ✅ ORDER BY 컬럼명 — 화이트리스트로 검증
ALLOWED_SORT_COLUMNS = {"id", "created_at", "name", "price"}
sort_col = request.args.get('sort', 'id')
if sort_col not in ALLOWED_SORT_COLUMNS:
    sort_col = 'id'
query = text(f"SELECT * FROM items ORDER BY {sort_col}")  # 화이트리스트 통과 후만
```

### JavaScript/Node.js 수정

```javascript
// ✅ mysql2 파라미터 바인딩
const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [userId]);

// ✅ Knex.js 파라미터 바인딩
const user = await knex('users').where('id', userId).first();

// ✅ TypeORM 안전 방식
const user = await userRepository.findOneBy({ id: userId });
// 또는
const user = await userRepository
  .createQueryBuilder('user')
  .where('user.id = :id', { id: userId })
  .getOne();
```

### Java 수정

```java
// ✅ PreparedStatement
String sql = "SELECT * FROM users WHERE id = ?";
PreparedStatement pstmt = conn.prepareStatement(sql);
pstmt.setString(1, userId);
ResultSet rs = pstmt.executeQuery();

// ✅ JPA Named Parameter
@Query("SELECT u FROM User u WHERE u.username = :username")
User findByUsername(@Param("username") String username);

// ✅ Spring Data JPA 메서드 네이밍
User findByUsernameAndStatus(String username, String status);
```

---

## 4️⃣ 심각도 판단 기준

```
CRITICAL (즉시 수정):
- 인증 없이 접근 가능한 엔드포인트 + SQLi
- UNION 기반 → 다른 테이블 데이터 추출 가능
- stacked queries → DROP, UPDATE, INSERT 가능
- blind SQLi + 자동화 도구로 추출 가능

HIGH (48시간 이내):
- 인증된 사용자만 접근 가능 + SQLi
- 읽기 전용 쿼리이지만 민감 데이터 포함
- Error-based SQLi (에러 메시지로 DB 구조 노출)

MEDIUM (1주일 이내):
- 내부 API에서만 호출되는 함수
- 입력값이 다른 곳에서 부분 검증되는 경우
- 추출 가능한 데이터가 비민감 정보

LOW:
- 내부 로직에서만 호출, 외부 입력 없음
- 영향 범위가 로컬 DB에만 한정
```

---

## 5️⃣ 보고 템플릿 예시

```
[취약점 ID]: VULN-users_api-047
[취약점명]: SQL Injection via f-string in user search endpoint
[OWASP]: A03:2021 - Injection
[CWE]: CWE-89
[CVSS v3.1]: 9.8 CRITICAL
  벡터: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
[위치]: src/api/users.py, line 47
[취약 코드]:
  query = f"SELECT * FROM users WHERE name = '{name}'"
[공격 시나리오]:
  name 파라미터에 "' OR 1=1--" 입력 시 전체 users 테이블 반환
  name 파라미터에 "'; UPDATE users SET is_admin=1 WHERE id=1--" 시 권한 상승
[수정]:
  user = db.query(User).filter(User.name == name).first()
```

---

*참조: OWASP SQL Injection Prevention Cheat Sheet*
*탐지 도구: sqlmap, Burp Suite Active Scan, Semgrep p/python*
