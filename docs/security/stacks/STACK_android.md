# 🤖 STACK_android — Android (Kotlin · Java) 보안 패턴
## RAG 추가 대상 | 로드 조건: apps/android 디렉토리의 .kt, .java 파일 감지 시

---

## 1️⃣ Android 즉시 CRITICAL/HIGH

```kotlin
// ── 암호화 키 하드코딩 (Hardcoded Cryptographic Keys) ─────────────────
val secretKey = "my_super_secret_key"
val keySpec = SecretKeySpec(secretKey.toByteArray(), "AES")

// ── Secure Storage 미사용 (Insecure Shared Preferences) ───────────────
// 암호화되지 않은 SharedPreferences에 민감 정보 저장
val sharedPref = context.getSharedPreferences("user_prefs", Context.MODE_PRIVATE)
sharedPref.edit().putString("password", rawPassword).apply()

// ── WebView SSL 검증 무시 (Insecure SSL Validation in WebView) ─────────
webView.webViewClient = object : WebViewClient() {
    override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
        handler.proceed() // SSL 에러 무시하고 진행 (CRITICAL 취약점)
    }
}

// ── WebView JavaScript Interface 활성화 ──────────────────────────────
// targetSdkVersion < 17일 때 JavaScript Interface 노출 시 RCE 위험
webView.settings.javaScriptEnabled = true
webView.addJavascriptInterface(WebAppInterface(this), "Android")

// ── Intent Hijacking / Insecure Component Exposure ─────────────────────
// AndroidManifest.xml에서 exported=true 이면서 Intent filter가 설정되어 외부에서 접근 가능한 Component
// Activity, Service, Receiver 등에서 Input Intent 데이터를 검증 없이 처리하여 권한 상승 유발
val intent = intent
val targetComponent = intent.getParcelableExtra<Intent>("target")
startActivity(targetComponent) // Intent Redirection 취약점

// ── SQLite Injection ──────────────────────────────────────────────────
val query = "SELECT * FROM users WHERE name = '" + username + "'"
db.rawQuery(query, null) // Parameter Binding 미사용 SQL Injection
```

## 2️⃣ Android 안전 예시 (Safe Patterns)

```kotlin
// ── EncryptedSharedPreferences 사용 ──────────────────────────────────
val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
val sharedPreferences = EncryptedSharedPreferences.create(
    "secure_prefs",
    masterKeyAlias,
    context,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)

// ── Parameterized SQLite Queries ──────────────────────────────────────
val query = "SELECT * FROM users WHERE name = ?"
db.rawQuery(query, arrayOf(username))
```
