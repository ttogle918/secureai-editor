"""
docs/security/ MD 파일을 security_guidelines 테이블 UPSERT SQL로 변환한다.

DB 드라이버 없이 실행 가능. 생성된 SQL을 psql에 직접 파이프한다.

사용법:
    python apps/ai_engine/scripts/generate_guidelines_sql.py | \
        docker exec -i secureai-postgres psql -U secureai -d secureai_db

SQL 파일로 저장 후 실행:
    python apps/ai_engine/scripts/generate_guidelines_sql.py > /tmp/guidelines.sql
    docker exec -i secureai-postgres psql -U secureai -d secureai_db < /tmp/guidelines.sql
"""

import io
import json
import re
import sys
from pathlib import Path

# Windows 콘솔의 cp949 한계 우회 — psql 파이프 시 반드시 UTF-8 필요
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

DOCS_DIR = Path(__file__).parent.parent.parent.parent / "docs" / "security"

# 인덱스·전략 문서는 분석 프롬프트에 직접 주입하기엔 너무 범용적이므로 제외
SKIP_FILES = {"D_MASTER.md", "INJECTION_STRATEGY.md"}

# 파일명 prefix → target_stack 매핑 (security_guidelines.target_stack 값)
_STEM_TO_STACK: dict[str, str] = {
    "STACK_java_spring":          "java_spring",
    "STACK_python_fastapi":       "python_fastapi",
    "STACK_common_python":        "common",
    "STACK_frontend_react_nextjs": "frontend_react_nextjs",
    "STACK_go_gin_echo":          "go_gin_echo",
    "STACK_node_express_nestjs":  "node_express_nestjs",
}


def _parse_md(file_path: Path) -> dict:
    content = file_path.read_text(encoding="utf-8")

    title_m = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    title = title_m.group(1).strip() if title_m else file_path.stem

    parent = file_path.parent.name

    if parent == "stacks":
        category = "Stack Specific"
        target_stack = _STEM_TO_STACK.get(file_path.stem, "common")
    elif parent == "attacks":
        category = "Attack Pattern"
        target_stack = "common"
    else:
        category = "General"
        target_stack = "common"

    metadata: dict = {}
    cwe = re.search(r"CWE-\d+", content)
    if cwe:
        metadata["cwe_id"] = cwe.group(0)
    owasp = re.search(r"A\d+:\d{4}", content)
    if owasp:
        metadata["owasp_id"] = owasp.group(0)

    return {
        "title":       title,
        "content":     content,
        "category":    category,
        "target_stack": target_stack,
        "metadata":    json.dumps(metadata, ensure_ascii=False),
        "source_path": str(file_path.relative_to(DOCS_DIR)),
    }


def _dollar_quote(text: str) -> str:
    """PostgreSQL dollar quoting — 본문 내 작은따옴표 이스케이프 불필요."""
    for tag in ("$body$", "$sec$", "$g$"):
        if tag not in text:
            return f"{tag}{text}{tag}"
    # 최후 수단: 임의 태그
    return f"$gu42${text}$gu42$"


def _sq(s: str) -> str:
    """single-quote 이스케이프 (짧은 문자열 전용)."""
    return s.replace("'", "''")


def main() -> None:
    if not DOCS_DIR.exists():
        print(f"-- ERROR: {DOCS_DIR} not found", file=sys.stderr)
        sys.exit(1)

    md_files = sorted(
        f for f in DOCS_DIR.glob("**/*.md") if f.name not in SKIP_FILES
    )

    if not md_files:
        print("-- WARNING: no markdown files found", file=sys.stderr)
        sys.exit(0)

    print("-- security_guidelines upsert")
    print(f"-- source: {DOCS_DIR}")
    print(f"-- files : {len(md_files)}")
    print()

    for md_file in md_files:
        row = _parse_md(md_file)

        print("INSERT INTO security_guidelines")
        print("  (category, target_stack, title, content, metadata, source_path, updated_at)")
        print("VALUES (")
        print(f"  '{_sq(row['category'])}',")
        print(f"  '{_sq(row['target_stack'])}',")
        print(f"  '{_sq(row['title'])}',")
        print(f"  {_dollar_quote(row['content'])},")
        print(f"  '{_sq(row['metadata'])}'::jsonb,")
        print(f"  '{_sq(row['source_path'])}',")
        print(f"  NOW()")
        print(") ON CONFLICT (title, target_stack) DO UPDATE SET")
        print("  content     = EXCLUDED.content,")
        print("  metadata    = EXCLUDED.metadata,")
        print("  category    = EXCLUDED.category,")
        print("  source_path = EXCLUDED.source_path,")
        print("  updated_at  = NOW();")
        print()

    print(f"-- done: {len(md_files)} rows upserted")


if __name__ == "__main__":
    main()
