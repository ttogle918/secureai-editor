# 🔌 INJECTION_STRATEGY — 지침서 주입 전략
## API 호출 시 보안 지침서를 어떻게 로드하고 주입할 것인가

---

## 전체 구조 한눈에 보기

```
테스트 시작 버튼 클릭 / API 호출
        │
        ▼
┌─────────────────────────────────────────────────┐
│  Layer 1: system prompt (항상 고정)              │
│  → D_MASTER.md 전문 주입                         │
│  → 토큰: ~800 토큰 (작고 핵심만)                 │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│  Layer 2: 스택 감지 → 해당 STACK 파일 추가 주입  │
│  → 파일 확장자 + import 구문 자동 감지            │
│  → 해당 스택 파일 1~2개 추가                      │
│  → 토큰: ~600~1200 토큰                          │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│  Layer 3: 분석 중 의심 패턴 → 공격 파일 RAG     │
│  → B01~B20 중 해당 파일 on-demand 로드           │
│  → 토큰: 파일당 ~400~800 토큰                    │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│  Layer 4: 분석 대상 코드                         │
│  → user message로 전달                           │
└─────────────────────────────────────────────────┘
```

---

## 구현 코드 (Python)

```python
# security_loader.py

import os
from pathlib import Path
from functools import lru_cache

SECURITY_DIR = Path(__file__).parent / "docs/security"

# ──────────────────────────────────────────────────
# 스택 자동 감지 규칙
# ──────────────────────────────────────────────────
STACK_DETECTION_RULES = {
    "python_fastapi": {
        "extensions": [".py"],
        "imports": ["fastapi", "from fastapi", "APIRouter"],
        "files": ["STACK_common_python.md", "STACK_python_fastapi.md"]
    },
    "python_flask": {
        "extensions": [".py"],
        "imports": ["flask", "from flask", "Flask(__name__)"],
        "files": ["STACK_common_python.md", "STACK_python_flask.md"]
    },
    "python_generic": {
        "extensions": [".py"],
        "imports": [],           # fastapi/flask 없는 일반 Python
        "files": ["STACK_common_python.md"]
    },
    "java_spring": {
        "extensions": [".java"],
        "imports": ["springframework", "@RestController", "@Service"],
        "files": ["STACK_java_spring.md"]
    },
    "node_nestjs": {
        "extensions": [".ts", ".js"],
        "imports": ["@nestjs/common", "@nestjs/core", "NestFactory"],
        "files": ["STACK_node_express_nestjs.md"]
    },
    "node_express": {
        "extensions": [".ts", ".js"],
        "imports": ["express()", "require('express')", "from 'express'"],
        "files": ["STACK_node_express_nestjs.md"]
    },
    "frontend_nextjs": {
        "extensions": [".tsx", ".ts", ".jsx"],
        "imports": ["next/", "from 'next'", "next.config", "pages/api", "app/api"],
        "files": ["STACK_frontend_react_nextjs.md"]
    },
    "frontend_react": {
        "extensions": [".tsx", ".jsx"],
        "imports": ["react", "from 'react'", "useState", "useEffect"],
        "files": ["STACK_frontend_react_nextjs.md"]
    },
    "go_gin": {
        "extensions": [".go"],
        "imports": ["gin-gonic/gin", "github.com/gin"],
        "files": ["STACK_go_gin_echo.md"]
    },
    "go_echo": {
        "extensions": [".go"],
        "imports": ["labstack/echo", "github.com/labstack"],
        "files": ["STACK_go_gin_echo.md"]
    },
}

# ──────────────────────────────────────────────────
# 공격 패턴 → B파일 매핑
# ──────────────────────────────────────────────────
ATTACK_PATTERN_RULES = {
    "B01_sqli.md": [
        r'f"SELECT.*\{', r'"SELECT.*"\s*\+', r'`SELECT.*\$\{',
        r'\.query\(.*\+', r'execute\(.*format\(',
    ],
    "B02_xss.md": [
        r'dangerouslySetInnerHTML', r'innerHTML\s*=', r'document\.write\(',
        r'insertAdjacentHTML', r'\.html\(.*\)',
    ],
    "B03_idor.md": [
        r'\.get\(id\)', r'findById\(', r'filter.*id.*==',
        # 소유권 검증 없는 패턴 감지는 컨텍스트 필요 → AI에게 판단 위임
    ],
    "B04_cmdinj.md": [
        r'os\.system\(', r'os\.popen\(', r'subprocess.*shell=True',
        r'exec\(.*input\)', r'Runtime\.exec\(',
        r'child_process.*exec\(', r'exec\.Command\("sh"',
    ],
    "B05_auth.md": [
        r'verify_signature.*False', r'algorithms=\[header\[',
        r'hashlib\.md5\(.*password', r'hashlib\.sha1\(.*password',
        r'Math\.random\(\).*token', r'rand\.Int\(\).*token',
    ],
    "B06_ssrf.md": [
        r'requests\.get\(', r'httpx\.get\(', r'fetch\(req\.',
        r'http\.Get\(', r'RestTemplate.*getForObject',
    ],
    "B07_crypto.md": [
        r'AES\.MODE_ECB', r'hashlib\.md5\(', r'hashlib\.sha1\(',
        r'verify=False', r'os\.urandom\(16\)', r'createHash\(.md5.\)',
    ],
    "B08_xxe.md": [
        r'xml\.etree', r'lxml', r'DocumentBuilderFactory',
        r'SAXParser', r'XMLParser\(\)',
    ],
    "B09_deser.md": [
        r'pickle\.loads\(', r'yaml\.load\(', r'marshal\.loads\(',
        r'ObjectInputStream', r'XStream',
    ],
    "B10_misconfig.md": [
        r'debug=True', r'DEBUG.*=.*True', r'app\.run\(debug=True\)',
        r'allow_origins=\["\*"\]', r'exposure\.include=\*',
    ],
    "B11_csrf.md": [
        r'set_cookie\(', r'SESSION_COOKIE', r'samesite',
        r'WTF_CSRF_ENABLED.*False',
    ],
    "B12_path.md": [
        r'open\(.*\+.*\)', r'FileResponse\(', r'send_from_directory\(',
        r'os\.path\.join.*input', r'filepath\.Join.*Param',
    ],
    "B13_massassign.md": [
        r'update\(data\)', r'\.update\(request\.json\)',
        r'__dict__\.update', r'model_config.*extra.*allow',
    ],
    "B14_redirect.md": [
        r'RedirectResponse\(.*next\)', r'redirect\(.*query\)',
        r'router\.push\(next\)', r'window\.location.*=.*query',
    ],
    "B15_supplychain.md": [
        r'requirements\.txt', r'package\.json', r'@main', r'@latest',
    ],
    "B16_secrets.md": [
        r'SECRET.*=.*["\'][^"\']{4,}["\']',
        r'PASSWORD.*=.*["\'][^"\']{4,}["\']',
        r'API_KEY.*=.*["\'][^"\']{8,}["\']',
        r'AKIA[0-9A-Z]{16}',
    ],
    "B17_ratelimit.md": [
        r'@app\.post.*login', r'@app\.post.*register',
        r'@app\.post.*forgot',  # Rate Limit 없는지는 AI 판단
    ],
    "B18_logging.md": [
        r'logger.*password', r'print.*token', r'console\.log.*password',
    ],
    "B19_llm.md": [
        r'openai', r'anthropic', r'langchain', r'llm\.',
        r'system_prompt.*\{.*input', r'Template.*user_input',
    ],
    "B20_cicd.md": [
        r'uses:.*@main', r'uses:.*@latest', r'uses:.*@master',
        r'echo.*secrets\.',
    ],
}


@lru_cache(maxsize=20)
def load_file(filename: str) -> str:
    """파일 캐시 로드 (반복 I/O 방지)"""
    path = SECURITY_DIR / filename
    if not path.exists():
        # stacks/ 하위도 탐색
        path = SECURITY_DIR / "stacks" / filename
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def detect_stacks(file_path: str, file_content: str) -> list[str]:
    """파일 확장자 + 내용으로 스택 자동 감지, 필요한 스택 파일 목록 반환"""
    ext = Path(file_path).suffix.lower()
    detected_files = set()

    for stack_name, rule in STACK_DETECTION_RULES.items():
        # 확장자 매칭
        if ext not in rule["extensions"]:
            continue
        # import 패턴 매칭 (없으면 모두 해당)
        if not rule["imports"]:
            detected_files.update(rule["files"])
            continue
        if any(imp in file_content for imp in rule["imports"]):
            detected_files.update(rule["files"])

    # 중복 제거 + 우선순위 (common 먼저)
    ordered = []
    for f in detected_files:
        if "common" in f:
            ordered.insert(0, f)
        else:
            ordered.append(f)
    return ordered


def detect_attack_patterns(file_content: str) -> list[str]:
    """코드에서 의심 패턴 탐지 → 관련 공격 파일 목록 반환"""
    import re
    relevant_attacks = []
    for attack_file, patterns in ATTACK_PATTERN_RULES.items():
        if any(re.search(p, file_content, re.IGNORECASE) for p in patterns):
            relevant_attacks.append(attack_file)
    return relevant_attacks


def build_system_prompt(
    file_path: str,
    file_content: str,
    max_attack_files: int = 5
) -> str:
    """
    분석 대상 파일에 맞는 system prompt 자동 조립.

    구성:
      1. D_MASTER.md (항상)
      2. 감지된 스택 파일 (자동)
      3. 감지된 공격 파일 (상위 N개, 토큰 절약)
    """
    parts = []

    # Layer 1: 마스터 지침서 (항상)
    master = load_file("D_MASTER.md")
    if master:
        parts.append(master)

    # Layer 2: 스택 파일 (자동 감지)
    stack_files = detect_stacks(file_path, file_content)
    for sf in stack_files:
        content = load_file(sf)
        if content:
            parts.append(f"\n---\n# 스택 특화 지침: {sf}\n{content}")

    # Layer 3: 공격 파일 (패턴 감지, 상위 N개)
    attack_files = detect_attack_patterns(file_content)
    for af in attack_files[:max_attack_files]:
        content = load_file(af)
        if content:
            parts.append(f"\n---\n# 공격 기법 참조: {af}\n{content}")

    return "\n".join(parts)


# ──────────────────────────────────────────────────
# API 호출 예시
# ──────────────────────────────────────────────────
def analyze_file(file_path: str, file_content: str) -> dict:
    """단일 파일 보안 분석 API 호출"""
    import anthropic

    system_prompt = build_system_prompt(file_path, file_content)

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system_prompt,
        messages=[{
            "role": "user",
            "content": f"""다음 파일을 보안 분석하세요.

파일 경로: {file_path}
파일 내용:
```
{file_content}
```

D_MASTER.md의 분석 순서와 보고 형식을 따르세요."""
        }]
    )

    return {
        "file": file_path,
        "analysis": response.content[0].text,
        "stacks_loaded": detect_stacks(file_path, file_content),
        "attacks_loaded": detect_attack_patterns(file_content)[:5],
    }


def analyze_multiple_files(files: dict[str, str]) -> list[dict]:
    """
    여러 파일 배치 분석.
    files = {"path/to/file.py": "file content", ...}
    """
    results = []
    for path, content in files.items():
        result = analyze_file(path, content)
        results.append(result)
    return results
```

---

## 토큰 예산 가이드

```
구성 요소              토큰 (대략)    포함 여부
─────────────────────────────────────────────────
D_MASTER.md            ~800          항상
STACK_common_python    ~600          Python 파일
STACK_python_fastapi   ~700          FastAPI 감지
STACK_java_spring      ~800          Java 파일
STACK_frontend_react_nextjs ~900     .tsx/.jsx
공격 파일 1개          ~400~700      패턴 감지 시
─────────────────────────────────────────────────
일반적인 system prompt: ~2,000~3,500 토큰
분석 대상 코드 (user):  가변
응답 (max_tokens):      4,096
─────────────────────────────────────────────────
claude-sonnet-4: context window 200K 토큰
→ 토큰 걱정 없이 모든 파일 로드 가능
→ 단, 불필요한 파일 로드는 노이즈 증가
```

---

## 파일 디렉토리 구조 (최종)

```
docs/security/
├── D_MASTER.md                        ← system prompt 고정 주입
├── A_취약점_분석기준_OWASP_CWE_CVSS.md  ← 필요 시 RAG
├── C_GitHub_PR_보안_체크리스트.md       ← Sprint 5용
│
├── stacks/                            ← 스택 자동 감지 → 추가 주입
│   ├── STACK_common_python.md
│   ├── STACK_python_fastapi.md
│   ├── STACK_python_flask.md
│   ├── STACK_java_spring.md
│   ├── STACK_node_express_nestjs.md
│   ├── STACK_frontend_react_nextjs.md
│   └── STACK_go_gin_echo.md
│
└── attacks/                           ← 패턴 감지 → on-demand RAG
    ├── B01_sqli.md
    ├── B02_xss.md
    └── ... (B03~B20)
```

> **attacks/ 폴더 구성 방법:**
> 기존 B01~B20 파일들을 `docs/security/attacks/` 로 복사하고
> 파일명을 `B01_sqli.md`, `B02_xss.md` 형식으로 통일하세요.
> `security_loader.py`의 `ATTACK_PATTERN_RULES`에서 해당 이름으로 참조합니다.
