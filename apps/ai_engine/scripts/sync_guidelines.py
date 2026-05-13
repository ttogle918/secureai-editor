import os
import re
import uuid
import json
import psycopg
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# .env 파일 로드 (루트 디렉토리 탐색)
load_dotenv(Path(__file__).parent.parent.parent.parent / ".env")

# DB 연결 정보 구성
def get_db_url():
    # 1. POSTGRES_URL 환경변수 우선 (Docker 내부 또는 명시적 설정)
    url = os.getenv("POSTGRES_URL")
    if url:
        # 로컬에서 실행 시 호스트가 'postgres'로 되어있으면 'localhost'로 교체
        if "localhost" not in url and "@postgres:" in url:
            url = url.replace("@postgres:", "@localhost:")
        return url
    
    # 2. 개별 변수로 구성 (로컬 실행 환경)
    user = os.getenv("DB_USER", "secureai")
    pw = os.getenv("DB_PASSWORD", "secureai")
    db = os.getenv("DB_NAME", "secureai")
    return f"postgresql://{user}:{pw}@localhost:5432/{db}"

DB_URL = get_db_url()

# 보안 지침 디렉토리 설정 (Docker 컨테이너 내부 환경 대응)
def get_security_docs_dir():
    # Docker 환경: /workspace 하위에 프로젝트 루트가 마운트됨
    docker_path = Path("/workspace/docs/security")
    if docker_path.exists():
        return docker_path
    
    # 로컬 환경: 스크립트 위치 기준 상대 경로
    return Path(__file__).parent.parent.parent.parent / "docs" / "security"

SECURITY_DOCS_DIR = get_security_docs_dir()

def parse_md_file(file_path: Path):
    """마크다운 파일을 파싱하여 지침 데이터를 추출한다."""
    content = file_path.read_text(encoding="utf-8")
    
    # 제목 추출 (첫 번째 # 제목)
    title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else file_path.stem
    
    # 카테고리 및 스택 추론 (파일 경로 및 이름 기반)
    parent_dir = file_path.parent.name
    target_stack = "common"
    category = "General"
    
    if parent_dir == "stacks":
        category = "Stack Specific"
        target_stack = file_path.stem.replace("STACK_", "")
    elif parent_dir == "attacks":
        category = "Attack Pattern"
        # B01_sqli -> sqli 추출
        category_match = re.search(r"B\d+_(.+)", file_path.stem)
        if category_match:
            target_stack = "common"
            category = category_match.group(1).upper()

    # 메타데이터 추출 (간단한 예시)
    metadata = {}
    cwe_match = re.search(r"CWE-\d+", content)
    if cwe_match:
        metadata["cwe_id"] = cwe_match.group(0)
    
    owasp_match = re.search(r"A\d+:\d+", content)
    if owasp_match:
        metadata["owasp_id"] = owasp_match.group(0)

    return {
        "title": title,
        "content": content,
        "category": category,
        "target_stack": target_stack,
        "metadata": json.dumps(metadata),
        "source_path": str(file_path.relative_to(SECURITY_DOCS_DIR))
    }

def sync_to_db():
    """docs/security 하위의 모든 MD 파일을 DB와 동기화한다."""
    print(f"🚀 보안 지침 동기화 시작: {SECURITY_DOCS_DIR.absolute()}")
    
    guidelines = []
    for md_file in SECURITY_DOCS_DIR.glob("**/*.md"):
        # 마스터 지침이나 기준 문서는 스킵 (필요에 따라 포함 가능)
        if md_file.name in ["D_MASTER.md", "D_종합_마스터_지침서.md", "INJECTION_STRATEGY.md"]:
            continue
        
        try:
            data = parse_md_file(md_file)
            guidelines.append(data)
            print(f"  - 파싱 완료: {md_file.name}")
        except Exception as e:
            print(f"  - 파싱 실패: {md_file.name} ({e})")

    if not guidelines:
        print("⚠️ 동기화할 지침이 없습니다.")
        return

    try:
        with psycopg.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                for g in guidelines:
                    cur.execute("""
                        INSERT INTO security_guidelines 
                        (category, target_stack, title, content, metadata, source_path, updated_at)
                        VALUES (%(category)s, %(target_stack)s, %(title)s, %(content)s, %(metadata)s, %(source_path)s, NOW())
                        ON CONFLICT (title, target_stack) 
                        DO UPDATE SET 
                            content = EXCLUDED.content,
                            metadata = EXCLUDED.metadata,
                            category = EXCLUDED.category,
                            source_path = EXCLUDED.source_path,
                            updated_at = NOW();
                    """, g)
            conn.commit()
        print(f"✅ {len(guidelines)}개의 보안 지침이 성공적으로 동기화되었습니다.")
    except Exception as e:
        print(f"❌ DB 동기화 중 오류 발생: {e}")

if __name__ == "__main__":
    sync_to_db()
