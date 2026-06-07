# B01: SQL Injection
OWASP: A03:2021 | CWE-89 | CVSS: 7.5~9.8 CRITICAL

## 취약 패턴 (탐지 즉시 CRITICAL)
```python
# Python
f"SELECT * FROM users WHERE id = '{user_id}'"
"SELECT * FROM users WHERE name = '%s'" % name
"SELECT * FROM " + table + " WHERE id = " + str(id)
"UPDATE users SET email='{}' WHERE id={}".format(email, uid)
db.execute("SELECT * FROM users WHERE id = " + request.args.get('id'))
db.execute(text(f"SELECT * FROM users WHERE id = '{user_id}'"))  # text() + f-string
```
```javascript
// JS/TS
`SELECT * FROM users WHERE id = '${userId}'`
"SELECT * FROM users WHERE id = " + req.body.id
knex.raw(`SELECT * FROM users WHERE id = ${id}`)
connection.query(`SELECT * FROM user WHERE id = '${id}'`)
```
```java
// Java
"SELECT * FROM users WHERE id = '" + userId + "'"
"FROM User WHERE username = '" + username + "'"
@Query("SELECT u FROM User u WHERE u.name = '" + name + "'")
```

## 수정 패턴
```python
# Python ✅
db.query(User).filter(User.id == user_id).first()           # ORM
db.execute(text("SELECT * FROM u WHERE id = :uid"), {"uid": user_id})  # 바인딩
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
# ORDER BY 컬럼: 화이트리스트
ALLOWED = {"id","name","created_at"}
col = col if col in ALLOWED else "id"
```
```javascript
db.execute('SELECT * FROM users WHERE id = ?', [userId])     // ✅
knex('users').where('id', userId).first()                    // ✅
userRepo.createQueryBuilder().where('u.id = :id', { id })    // ✅
```
```java
"SELECT * FROM users WHERE id = ?"  // PreparedStatement  ✅
@Query("SELECT u FROM User u WHERE u.username = :username") // ✅
findByUsernameAndStatus(String username, String status)      // ✅
```

## 심각도
- CRITICAL: 인증 없는 public 엔드포인트 + SQLi
- CRITICAL: UNION / stacked queries 가능
- HIGH: 인증된 사용자만 접근 + SQLi
- MEDIUM: 내부 API, 읽기 전용, 비민감 데이터
