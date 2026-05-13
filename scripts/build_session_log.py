"""
docs/session_log/*.md → docs/portfolio/viewer/logs-data.js 변환 스크립트

Usage:
    python scripts/build_session_log.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
LOG_DIR = ROOT / "docs" / "session_log"
VIEWER_DIR = ROOT / "docs" / "portfolio" / "viewer"


def extract_title(content: str) -> str:
    for line in content.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return "세션 요약"


def extract_branch(content: str) -> str:
    match = re.search(r"\*\*브랜치\*\*[:\s]*`([^`]+)`", content)
    return match.group(1) if match else ""


def extract_scope(content: str) -> str:
    match = re.search(r"\*\*작업 범위\*\*[:\s]*(.+)", content)
    if match:
        return match.group(1).strip()
    match = re.search(r"\*\*작업 시간\*\*[:\s]*(.+)", content)
    if match:
        return match.group(1).strip()
    return ""


def main():
    VIEWER_DIR.mkdir(parents=True, exist_ok=True)

    logs = []
    for md_file in sorted(LOG_DIR.glob("*.md"), reverse=True):
        content = md_file.read_text(encoding="utf-8")
        date_str = md_file.stem[:10]
        logs.append(
            {
                "date": date_str,
                "filename": md_file.name,
                "title": extract_title(content),
                "branch": extract_branch(content),
                "scope": extract_scope(content),
                "content": content,
            }
        )

    output = VIEWER_DIR / "logs-data.js"
    js = f"window.SESSION_LOGS = {json.dumps(logs, ensure_ascii=False, indent=2)};\n"
    output.write_text(js, encoding="utf-8")
    print(f"[OK] {len(logs)}개 세션 로그 -> {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
