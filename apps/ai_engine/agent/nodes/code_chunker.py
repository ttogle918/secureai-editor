"""
코드 청킹 모듈 — 대용량 파일을 컨텍스트 윈도우에 맞게 분할한다.

- 300 라인 이하 파일은 단일 청크로 반환
- 300 라인 초과 파일은 max_lines 단위로 분할, 앞뒤 overlap 라인 오버랩 적용
- 오버랩이 있어야 청크 경계에서 취약점 컨텍스트가 절단되지 않는다
- 외부 의존성 없음 (순수 함수 모듈) → 단위 테스트 용이
"""
import math
from dataclasses import dataclass

_CHUNK_THRESHOLD = 300  # 이 라인 수 이하는 청크 분할 없이 통째로 처리


@dataclass
class FileChunk:
    file_path: str
    chunk_index: int    # 0-based
    total_chunks: int
    start_line: int     # 1-based, inclusive
    end_line: int       # 1-based, inclusive
    content: str


def chunk_file(
    file_path: str,
    content: str,
    max_lines: int = 250,
    overlap: int = 25,
) -> list[FileChunk]:
    """
    파일 내용을 청크 목록으로 분할한다.

    300 라인 이하면 청크 1개(전체)를 반환한다.
    300 라인 초과면 (max_lines - overlap) 간격으로 슬라이딩 윈도우를 적용한다.
    """
    lines = content.splitlines()
    total_lines = len(lines)

    if total_lines <= _CHUNK_THRESHOLD:
        return [
            FileChunk(
                file_path=file_path,
                chunk_index=0,
                total_chunks=1,
                start_line=1,
                end_line=total_lines if total_lines > 0 else 1,
                content=content,
            )
        ]

    return _split_into_chunks(file_path, lines, max_lines, overlap)


def _split_into_chunks(
    file_path: str,
    lines: list[str],
    max_lines: int,
    overlap: int,
) -> list[FileChunk]:
    """슬라이딩 윈도우로 청크 목록을 생성한다."""
    total_lines = len(lines)
    step = max_lines - overlap  # 각 청크가 전진하는 라인 수

    # 첫 청크 시작(0)부터 total_lines 초과 전까지 각 청크의 시작 인덱스 계산
    starts = list(range(0, total_lines, step))
    total_chunks = len(starts)

    chunks: list[FileChunk] = []
    for chunk_index, start_idx in enumerate(starts):
        end_idx = min(start_idx + max_lines, total_lines)
        chunk_lines = lines[start_idx:end_idx]

        chunks.append(
            FileChunk(
                file_path=file_path,
                chunk_index=chunk_index,
                total_chunks=total_chunks,
                start_line=start_idx + 1,           # 1-based
                end_line=start_idx + len(chunk_lines),  # 1-based, inclusive
                content="\n".join(chunk_lines),
            )
        )

    return chunks
