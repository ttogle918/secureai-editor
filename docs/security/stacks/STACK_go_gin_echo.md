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

---

## 2️⃣ Go 즉시 HIGH

```go
// ── 인증 미들웨어 없는 라우트 ────────────────────────

// Gin
r := gin.Default()
r.GET("/api/admin/users", listAllUsers)   // AuthMiddleware 없음

// Echo
e.GET("/api/admin/users", listAllUsers)   // middleware 없음

// ── IDOR — 소유권 검증 없음 ──────────────────────────

// Gin
func getOrder(c *gin.Context) {
    id := c.Param("id")
    var order Order
    db.First(&order, id)              // 현재 사용자와 소유권 비교 없음
    c.JSON(200, order)
}

// ── SSRF ─────────────────────────────────────────────
func proxyHandler(c *gin.Context) {
    url := c.Query("url")
    resp, _ := http.Get(url)           // url 검증 없음
    body, _ := io.ReadAll(resp.Body)
    c.String(200, string(body))
}

// ── 약한 난수 (암호화 용도) ──────────────────────────
import "math/rand"
token := rand.Int63()                  // 예측 가능
sessionID := fmt.Sprintf("%d", rand.Intn(1000000))

// ── Rate Limiting 없는 로그인 ────────────────────────
r.POST("/api/auth/login", loginHandler)  // Rate Limit 미들웨어 없음

// ── JWT 검증 오류 ─────────────────────────────────────
token, _ := jwt.ParseWithClaims(tokenStr, claims,
    func(token *jwt.Token) (interface{}, error) {
        return secret, nil             // 알고리즘 검증 없음
    })
// ✅ jwt.SigningMethodHS256 확인 필요:
// if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok { return nil, error }
```

---

## 3️⃣ Go 올바른 패턴 (참조)

```go
// ✅ SQL 파라미터 바인딩 (database/sql)
rows, err := db.Query("SELECT * FROM users WHERE id = ?", userID)

// ✅ GORM ORM 사용 (안전)
var user User
db.Where("id = ? AND owner_id = ?", id, currentUserID).First(&user)

// ✅ Command Injection 방지 — 인자 분리
cmd := exec.Command("ping", "-c", "1", host)  // shell 없이 직접 실행
// host 입력 검증도 함께
if !regexp.MustCompile(`^[a-zA-Z0-9.\-]+$`).MatchString(host) {
    c.JSON(400, gin.H{"error": "invalid host"})
    return
}

// ✅ Path Traversal 방지
func safeFilePath(baseDir, filename string) (string, error) {
    cleanName := filepath.Base(filename)           // 경로 구분자 제거
    target := filepath.Join(baseDir, cleanName)
    absTarget, err := filepath.Abs(target)
    if err != nil { return "", err }
    absBase, _ := filepath.Abs(baseDir)
    if !strings.HasPrefix(absTarget, absBase+string(filepath.Separator)) {
        return "", fmt.Errorf("path traversal detected")
    }
    return absTarget, nil
}

// ✅ 안전한 난수 (crypto/rand)
import "crypto/rand"
import "encoding/hex"

func generateToken(n int) (string, error) {
    bytes := make([]byte, n)
    if _, err := rand.Read(bytes); err != nil {
        return "", err
    }
    return hex.EncodeToString(bytes), nil
}

// ✅ Gin 보안 미들웨어
r := gin.New()
r.Use(gin.Recovery())           // panic → 500 (스택 트레이스 미노출)
r.Use(securityHeadersMiddleware())

func securityHeadersMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("X-Content-Type-Options", "nosniff")
        c.Header("X-Frame-Options", "DENY")
        c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        c.Next()
    }
}

// ✅ JWT 알고리즘 명시적 검증
token, err := jwt.ParseWithClaims(tokenStr, claims,
    func(token *jwt.Token) (interface{}, error) {
        // 알고리즘 검증 필수
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
        }
        return []byte(os.Getenv("JWT_SECRET")), nil
    })

// ✅ SSRF 방어
var blockedNetworks = []*net.IPNet{ /* 10.x, 172.16.x, 192.168.x, 169.254.x */ }
var allowedDomains = map[string]bool{"api.partner.com": true}

func validateURL(rawURL string) error {
    u, err := url.Parse(rawURL)
    if err != nil { return err }
    if u.Scheme != "https" { return fmt.Errorf("only https allowed") }
    if !allowedDomains[u.Hostname()] { return fmt.Errorf("domain not allowed") }
    return nil
}
```

---

## 4️⃣ Go 의존성 특이사항

```
golang-jwt/jwt < v5    → alg confusion 취약점 (v5로 업그레이드)
gin-gonic/gin < 1.9.x  → 정기 패치 확인
labstack/echo < 4.11   → 보안 패치 확인
GORM                   → raw SQL 사용 시 주의 (ORM은 안전)
crypto/md5             → 비밀번호 해시 용도 사용 금지 (CRITICAL)
math/rand              → 보안 목적 사용 금지, crypto/rand 사용
```
