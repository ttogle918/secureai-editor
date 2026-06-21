import ast
import logging
import re
import os

try:
    import javalang
except ImportError:
    javalang = None

logger = logging.getLogger(__name__)

# 각 언어별 위험 관심사(Concerns) 키워드 세트 (텍스트 빠른 매칭용)
_PYTHON_SENSITIVE_KEYWORDS = {
    # SQL / DB
    "execute", "raw", "cursor", "connect", "sqlite3", "psycopg", "pymysql",
    "sqlalchemy", "db", "sql",
    # OS Command execution
    "subprocess", "popen", "spawn", "shutil", "system", "os",
    # Dynamic execution / Deserialization
    "eval", "exec", "pickle", "yaml", "load", "loads",
    # File I/O (Path traversal 등)
    "open", "read", "write",
    # SSRF
    "requests", "urllib", "http"
}

_JAVA_SENSITIVE_KEYWORDS = {
    # Connection & Statement
    "Connection", "Statement", "PreparedStatement", "JdbcTemplate", "EntityManager",
    "Repository", "rawQuery",
    # Command execution
    "exec", "ProcessBuilder", "Runtime",
    # File & Network (Path traversal / SSRF)
    "FileInputStream", "FileOutputStream", "Socket", "HttpURLConnection", "URL", "InputStream", "OutputStream",
    # Android specific security concerns
    "getSharedPreferences", "WebView", "WebViewClient", "SslErrorHandler", "addJavascriptInterface", "Intent"
}

_JS_TS_SENSITIVE_KEYWORDS = {
    # Frontend vulnerabilities / XSS
    "dangerouslySetInnerHTML", "innerHTML", "eval", "Function",
    # Command execution
    "child_process", "exec", "spawn", "execSync", "run",
    # Database / SQL
    "query", "sql", "mysql", "pg", "sqlite", "mongoose", "db",
    # File I/O (Path traversal)
    "fs", "readFile", "readFileSync", "writeFile", "writeFileSync", "path",
    # Dynamic module load & Redirect
    "require", "redirect",
    # Prototype pollution
    "prototype", "__proto__", "constructor"
}



class _PythonPreFilterVisitor(ast.NodeVisitor):
    """Python AST를 순회하며 위험 API 호출 및 모듈 임포트를 감지한다."""
    def __init__(self):
        self.has_concern = False

    def visit_Call(self, node):
        # 함수 이름 직접 호출 (예: execute(), eval())
        if isinstance(node.func, ast.Name):
            if node.func.id in _PYTHON_SENSITIVE_KEYWORDS:
                self.has_concern = True
        # 속성 호출 (예: db.execute(), subprocess.run())
        elif isinstance(node.func, ast.Attribute):
            if node.func.attr in _PYTHON_SENSITIVE_KEYWORDS:
                self.has_concern = True
        self.generic_visit(node)

    def visit_Import(self, node):
        for name in node.names:
            if name.name.split('.')[0] in _PYTHON_SENSITIVE_KEYWORDS:
                self.has_concern = True
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if node.module and node.module.split('.')[0] in _PYTHON_SENSITIVE_KEYWORDS:
            self.has_concern = True
        for name in node.names:
            if name.name in _PYTHON_SENSITIVE_KEYWORDS:
                self.has_concern = True
        self.generic_visit(node)


def _check_python(content: str) -> bool:
    """Python 코드를 AST와 키워드로 검사하여 LLM 스킵 여부를 반환한다."""
    # 1. 텍스트 빠른 1차 스크리닝 (위험 키워드가 아예 없는 청정 파일이면 AST 파싱도 생략)
    words = set(re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]*\b", content))
    if not words.intersection(_PYTHON_SENSITIVE_KEYWORDS):
        return True

    # 2. 정밀 AST 검증
    try:
        tree = ast.parse(content)
        visitor = _PythonPreFilterVisitor()
        visitor.visit(tree)
        return not visitor.has_concern
    except SyntaxError:
        # 문법 에러가 있는 불완전한 코드는 안전을 위해 LLM에 전달하여 처리하게 함
        return False
    except Exception as exc:
        logger.warning("[ast_pre_filter] Python AST parsing unexpected error: %s", exc)
        return False


def _check_java_kotlin(content: str, is_kotlin: bool = False) -> bool:
    """Java/Kotlin 코드를 검사하여 LLM 스킵 여부를 반환한다.

    Kotlin 혹은 javalang 파싱 실패 시에는 정규식/텍스트 기법으로 안전 폴백한다.
    """
    # 1. 텍스트 1차 스크리닝
    words = set(re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]*\b", content))
    if not words.intersection(_JAVA_SENSITIVE_KEYWORDS):
        return True

    if is_kotlin or not javalang:
        # Kotlin 파일이거나 javalang 모듈이 없는 경우, 텍스트 매칭 결과에 의존
        # 키워드가 발견되었으므로 LLM에 전달
        return False

    # 2. Java 정밀 AST 검사
    try:
        tree = javalang.parse.parse(content)
        # javalang AST 트리 내에서 특정 노드 참조 확인
        for _, node in tree:
            # 메서드 호출 확인
            if isinstance(node, javalang.tree.MethodInvocation):
                if node.member in _JAVA_SENSITIVE_KEYWORDS:
                    return False
            # 클래스 생성 확인 (예: new ProcessBuilder())
            elif isinstance(node, javalang.tree.ClassCreator):
                if node.type.name in _JAVA_SENSITIVE_KEYWORDS:
                    return False
            # 참조 타입 선언 확인 (예: Connection conn)
            elif isinstance(node, javalang.tree.ReferenceType):
                if node.name in _JAVA_SENSITIVE_KEYWORDS:
                    return False
        return True
    except Exception:
        # 파싱 에러(자바 버전 불일치 등) 발생 시 안전을 위해 LLM에 분석 전달
        return False


def _check_js_ts(content: str) -> bool:
    """JS/TS 코드를 빠른 텍스트 분석하여 LLM 스킵 여부를 반환한다."""
    # ESLint 스타일 정규식 및 식별자 대조
    words = set(re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]*\b", content))
    if not words.intersection(_JS_TS_SENSITIVE_KEYWORDS):
        return True

    # dangerouslySetInnerHTML, eval 등의 존재 여부 검사
    for keyword in _JS_TS_SENSITIVE_KEYWORDS:
        if keyword in content:
            return False

    return True


def should_skip_llm(file_path: str, content: str, language: str) -> bool:
    """분석 대상 파일의 구문을 정적 분석하여 LLM 호출을 건너뛸 수 있는지 여부를 판별한다.

    Args:
        file_path: 분석 대상 파일 경로.
        content: 파일 내용.
        language: "python" | "java" | "kotlin" | "typescript" | "javascript" 등 감지된 언어명.

    Returns:
        True: 위험 요소가 아예 없으므로 LLM 호출을 생략해도 안전함.
        False: 분석 필요 요소가 있거나 판독 불가능하므로 LLM 분석을 진행해야 함.
    """
    if not content or not content.strip():
        return True

    lang = language.lower() if language else ""
    if not lang:
        # 파일 확장자로 간접 추론
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".py":
            lang = "python"
        elif ext == ".java":
            lang = "java"
        elif ext == ".kt":
            lang = "kotlin"
        elif ext in (".js", ".jsx"):
            lang = "javascript"
        elif ext in (".ts", ".tsx"):
            lang = "typescript"

    if lang == "python":
        return _check_python(content)
    elif lang == "java":
        return _check_java_kotlin(content, is_kotlin=False)
    elif lang == "kotlin":
        return _check_java_kotlin(content, is_kotlin=True)
    elif lang in ("javascript", "typescript"):
        return _check_js_ts(content)

    # 미지원 언어는 안전을 위해 스킵하지 않음
    return False
