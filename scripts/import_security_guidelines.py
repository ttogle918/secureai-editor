"""
docs/security/ 마크다운 문서를 security_guidelines 테이블에 임포트한다.

사용법:
  python scripts/import_security_guidelines.py

환경변수:
  DATABASE_URL  (기본: .env 파일에서 읽거나 localhost 로컬 DB)

멱등성: ON CONFLICT (title, target_stack) DO UPDATE 로 재실행 안전.
"""
import os
import re
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv

# ── 경로 설정 ─────────────────────────────────────────────────────
REPO_ROOT   = Path(__file__).resolve().parents[1]
ENV_FILE    = REPO_ROOT / ".env"
load_dotenv(ENV_FILE)

# DOCS_DIR: 환경변수로 오버라이드 가능 (Docker 내 실행 시)
DOCS_DIR    = Path(os.getenv("DOCS_DIR", str(REPO_ROOT / "docs" / "security")))

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://secureai:secureai@localhost:5432/secureai_db",
)

# ── 파일 → (target_stack, category) 매핑 ────────────────────────
FILE_META: dict[str, tuple[str, str]] = {
    # 공통 기준 문서
    "A_취약점_분석기준_OWASP_CWE_CVSS.md":  ("common", "standards"),
    "C_GitHub_PR_보안_체크리스트.md":        ("common", "pr_checklist"),
    "D_MASTER.md":                           ("common", "master_prompt"),
    # 스택별 가이드라인
    "stacks/STACK_frontend_react_nextjs.md": ("frontend_react_nextjs", "stack"),
    "stacks/STACK_java_spring.md":           ("java_spring",           "stack"),
    "stacks/STACK_python_fastapi.md":        ("python_fastapi",        "stack"),
    "stacks/STACK_common_python.md":         ("common",                "stack"),
    "stacks/STACK_node_express_nestjs.md":   ("node_express_nestjs",   "stack"),
    "stacks/STACK_go_gin_echo.md":           ("go_gin_echo",           "stack"),
    "stacks/INJECTION_STRATEGY.md":          ("common",                "injection"),
    # 공격 기법별 가이드라인
    "attacks/B01_SQLi_분석지침.md":                    ("common", "sqli"),
    "attacks/B02_05_XSS_IDOR_CmdInjection_Auth.md":   ("common", "xss_idor_auth"),
    "attacks/B06_10_SSRF_Crypto_XXE_Deserial_Misconfig.md": ("common", "ssrf_crypto_xxe"),
    "attacks/B11_CSRF_분석지침.md":                    ("common", "csrf"),
    "attacks/B12_14_PathTraversal_MassAssignment_OpenRedirect.md": ("common", "path_traversal"),
    "attacks/B15_17_SupplyChain_Secrets_RateLimit.md": ("common", "supply_chain"),
    "attacks/B18_20_Logging_AIPromptInjection_CICD.md":("common", "logging_ai_cicd"),
}

# ── H1/H2 섹션 분할 ──────────────────────────────────────────────
_H2_PATTERN = re.compile(r"^#{1,2} ", re.MULTILINE)


def split_sections(text: str, source_file: str) -> list[tuple[str, str]]:
    """마크다운을 H1/H2 기준으로 (title, content) 튜플 목록으로 분리한다.

    - 첫 번째 H1(파일 제목)은 단독 섹션으로 만들지 않고 이후 섹션의 접두사로만 사용한다.
    - 섹션이 없으면 파일 전체를 하나의 섹션으로 반환한다.
    - content가 빈 섹션(헤더만 있는 경우)은 건너뛴다.
    """
    # H1 제목 추출 (파일 전체 맥락 식별용)
    h1_match = re.match(r"^# (.+)$", text, re.MULTILINE)
    file_label = h1_match.group(1).strip() if h1_match else Path(source_file).stem

    # emoji 제거 (DB 저장/검색 편의)
    file_label = re.sub(r"[^\w\s\-_/·.:,()\[\]<>]", "", file_label).strip()

    splits = list(_H2_PATTERN.finditer(text))

    if not splits:
        # 섹션 구분 없음 → 파일 전체 단일 항목
        return [(file_label, text.strip())]

    sections: list[tuple[str, str]] = []
    for i, m in enumerate(splits):
        end = splits[i + 1].start() if i + 1 < len(splits) else len(text)
        chunk = text[m.start():end].strip()
        if not chunk:
            continue

        # 첫 줄 = 섹션 제목
        lines = chunk.splitlines()
        heading = re.sub(r"^#{1,2}\s+", "", lines[0]).strip()
        # emoji 제거
        heading = re.sub(r"[^\w\s\-_/·.:,()\[\]<>]", "", heading).strip()
        body = "\n".join(lines[1:]).strip()

        if not body:
            continue

        title = f"{file_label} — {heading}"[:255]  # DB 컬럼 길이 제한
        sections.append((title, body))

    return sections if sections else [(file_label, text.strip())]


# ── DB 임포트 ─────────────────────────────────────────────────────
UPSERT_SQL = """
INSERT INTO security_guidelines
    (target_stack, category, title, content, source_path)
VALUES
    (%s, %s, %s, %s, %s)
ON CONFLICT (title, target_stack)
DO UPDATE SET
    content     = EXCLUDED.content,
    category    = EXCLUDED.category,
    source_path = EXCLUDED.source_path,
    updated_at  = now()
"""


def import_all() -> None:
    inserted = updated = skipped = 0

    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            for rel_path, (target_stack, category) in FILE_META.items():
                full_path = DOCS_DIR / rel_path
                if not full_path.exists():
                    print(f"  [SKIP] 파일 없음: {rel_path}")
                    skipped += 1
                    continue

                text = full_path.read_text(encoding="utf-8")
                sections = split_sections(text, rel_path)

                for title, content in sections:
                    cur.execute(UPSERT_SQL, (
                        target_stack,
                        category,
                        title,
                        content,
                        str(full_path.relative_to(REPO_ROOT)),
                    ))
                    # rowcount는 upsert에서 항상 1 → statusmessage로 INSERT/UPDATE 구분
                    if cur.statusmessage == "INSERT 0 1":
                        inserted += 1
                    else:
                        updated += 1

                print(f"  [OK] {rel_path} → {target_stack}/{category}  ({len(sections)} 섹션)")

        conn.commit()

    total = inserted + updated
    print(f"\n완료: {total}개 행 처리 (신규 {inserted}, 갱신 {updated}, 파일 스킵 {skipped})")


if __name__ == "__main__":
    print(f"DB: {DB_URL.split('@')[-1]}")  # 비밀번호 노출 방지
    print(f"문서 경로: {DOCS_DIR}\n")
    try:
        import_all()
    except psycopg.OperationalError as e:
        print(f"DB 연결 실패: {e}", file=sys.stderr)
        sys.exit(1)
