"""
docs/ 내 마크다운 전체 → docs/portfolio/viewer/logs-data.js

Usage:
    python scripts/build_session_log.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
DOCS = ROOT / "docs"
OUT  = ROOT / "docs" / "portfolio" / "viewer" / "logs-data.js"

# (라벨, 아이콘, 디렉토리, 재귀)
CATEGORIES = [
    ("세션 로그",   "📋", DOCS / "session_log",     False),
    ("스프린트",    "🏃", DOCS / "sprints",          False),
    ("문서",        "📄", DOCS,                      False),  # 루트 .md만
    ("보안",        "🛡️", DOCS / "security",         True),
    ("설계 원칙",   "✏️", DOCS / "design",           False),
    ("트러블슈팅",  "🔧", DOCS / "troubleshooting",  False),
]

# 스캔에서 제외할 디렉토리 (루트 스캔 시)
_EXCLUDE_DIRS = {"portfolio", "frontend-reference", "sprints", "session_log",
                 "security", "design", "troubleshooting", "wireframes"}


def collect(directory: Path, recursive: bool) -> list[Path]:
    if not directory.exists():
        return []
    if recursive:
        files = [f for f in sorted(directory.rglob("*.md")) if f.is_file()]
    else:
        files = [f for f in sorted(directory.glob("*.md")) if f.is_file()]
        if directory == DOCS:
            files = [f for f in files if f.parent.name not in _EXCLUDE_DIRS]
    return files


def extract_title(content: str, fallback: str) -> str:
    for line in content.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return fallback


def extract_branch(content: str) -> str:
    m = re.search(r"\*\*브랜치\*\*[:\s]*`([^`]+)`", content)
    return m.group(1) if m else ""


def extract_scope(content: str) -> str:
    m = re.search(r"\*\*작업 범위\*\*[:\s]*(.+)", content)
    if m:
        return m.group(1).strip()
    m = re.search(r"\*\*작업 시간\*\*[:\s]*(.+)", content)
    if m:
        return m.group(1).strip()
    return ""


def build_item(md_file: Path) -> dict:
    content = md_file.read_text(encoding="utf-8")
    stem = md_file.stem
    date_str = stem[:10] if re.match(r"\d{4}-\d{2}-\d{2}", stem) else ""
    return {
        "filename": md_file.name,
        "title":    extract_title(content, stem),
        "date":     date_str,
        "branch":   extract_branch(content),
        "scope":    extract_scope(content),
        "content":  content,
    }


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)

    categories = []
    for label, icon, directory, recursive in CATEGORIES:
        files = collect(directory, recursive)
        if not files:
            continue
        # 세션 로그·스프린트는 최신 먼저, 나머지는 파일명 오름차순
        if label in ("세션 로그", "스프린트", "트러블슈팅"):
            files = list(reversed(files))
        items = [build_item(f) for f in files]
        categories.append({"label": label, "icon": icon, "items": items})

    payload = json.dumps({"categories": categories}, ensure_ascii=False, indent=2)
    OUT.write_text(f"window.DOCS_DATA = {payload};\n", encoding="utf-8")

    total = sum(len(c["items"]) for c in categories)
    print(f"[OK] {total} docs / {len(categories)} categories -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
