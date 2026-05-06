# 🐹 STACK_go_gin_echo — Go (Gin · Echo) 보안 패턴
## RAG 추가 대상 | 로드 조건: .go 파일 + gin or echo import 감지 시

---

## 1️⃣ Go 즉시 CRITICAL

```go
// ── SQL Injection ─────────────────────────────────────
query := "SELECT * FROM users WHERE id = '" + userId + "'"
db.Query(query)

query := fmt.Sprintf("SELECT * FROM users WHERE name = '%s'", name)
db.Exec(query)

// ── Command Injection ─────────────────────────────────
cmd := exec.Command("sh", "-c", "ping " + host)   // sh -c + 사용자 입력
out, _ := cmd.Output()

cmd := exec.Command("bash", "-c", userInput)

// ── Path Traversal ────────────────────────────────────
filePath := "./uploads/" + c.Param("filename")
data, _ := os.ReadFile(filePath)                   // 경로 검증 없음

// ── 하드코딩 자격증명 ────────────────────────────────
jwtSecret := []byte("secret")
jwtSecret := []byte("my-super-secret-key")
dbPassword := "admin123"
```
... (rest of the file)
