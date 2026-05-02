"""code_chunker.py 단위 테스트 — 백로그 체크리스트 대응."""
import math

import pytest

from agent.nodes.code_chunker import FileChunk, chunk_file

FILE = "src/LargeService.java"


# ── 소규모 파일 (300 라인 이하) ──────────────────────────────────────────────

def test_small_file_returns_single_chunk():
    """300 라인 이하 파일은 청크 1개, 전체 내용 그대로 반환해야 한다."""
    content = "\n".join(f"line {i}" for i in range(1, 101))  # 100 라인
    chunks = chunk_file(FILE, content)

    assert len(chunks) == 1
    assert chunks[0].chunk_index == 0
    assert chunks[0].total_chunks == 1
    assert chunks[0].content == content
    assert chunks[0].start_line == 1
    assert chunks[0].end_line == 100


def test_exactly_300_lines_is_single_chunk():
    """정확히 300 라인인 파일은 단일 청크로 처리해야 한다."""
    content = "\n".join(f"line {i}" for i in range(1, 301))  # 300 라인
    chunks = chunk_file(FILE, content)

    assert len(chunks) == 1
    assert chunks[0].total_chunks == 1


def test_empty_file_returns_single_chunk():
    """빈 파일도 청크 1개를 반환해야 한다."""
    chunks = chunk_file(FILE, "")
    assert len(chunks) == 1
    assert chunks[0].content == ""


# ── 대규모 파일 (300 라인 초과) ──────────────────────────────────────────────

def test_10000_line_file_chunk_count():
    """10000 라인 파일의 청크 수는 ceil(10000 / (250-25)) 와 같아야 한다."""
    total_lines = 10000
    max_lines = 250
    overlap = 25
    step = max_lines - overlap  # 225

    expected_chunks = math.ceil(total_lines / step)

    content = "\n".join(f"line {i}" for i in range(1, total_lines + 1))
    chunks = chunk_file(FILE, content, max_lines=max_lines, overlap=overlap)

    assert len(chunks) == expected_chunks


def test_first_chunk_starts_at_line_1():
    """첫 번째 청크의 start_line은 반드시 1이어야 한다."""
    content = "\n".join(f"line {i}" for i in range(1, 1001))  # 1000 라인
    chunks = chunk_file(FILE, content)

    assert chunks[0].start_line == 1


def test_last_chunk_ends_at_last_line():
    """마지막 청크의 end_line은 파일 전체 라인 수와 같아야 한다."""
    total_lines = 1000
    content = "\n".join(f"line {i}" for i in range(1, total_lines + 1))
    chunks = chunk_file(FILE, content)

    assert chunks[-1].end_line == total_lines


def test_adjacent_chunks_overlap():
    """인접 청크는 오버랩되어야 한다: chunk[i].end_line >= chunk[i+1].start_line."""
    content = "\n".join(f"line {i}" for i in range(1, 1001))
    chunks = chunk_file(FILE, content)

    for i in range(len(chunks) - 1):
        assert chunks[i].end_line >= chunks[i + 1].start_line, (
            f"chunk[{i}].end_line={chunks[i].end_line} < "
            f"chunk[{i + 1}].start_line={chunks[i + 1].start_line}"
        )


def test_all_chunks_have_consistent_total_chunks():
    """모든 청크의 total_chunks 값이 동일해야 한다."""
    content = "\n".join(f"line {i}" for i in range(1, 501))
    chunks = chunk_file(FILE, content)

    total = chunks[0].total_chunks
    assert all(c.total_chunks == total for c in chunks)


def test_chunk_index_is_sequential():
    """chunk_index는 0부터 순서대로 증가해야 한다."""
    content = "\n".join(f"line {i}" for i in range(1, 1001))
    chunks = chunk_file(FILE, content)

    for i, chunk in enumerate(chunks):
        assert chunk.chunk_index == i


def test_chunk_content_covers_all_lines():
    """모든 청크의 라인들을 합치면 원본 파일의 모든 라인을 포함해야 한다 (중복 허용)."""
    total_lines = 500
    content = "\n".join(f"line {i}" for i in range(1, total_lines + 1))
    chunks = chunk_file(FILE, content)

    covered = set()
    for chunk in chunks:
        covered.update(range(chunk.start_line, chunk.end_line + 1))

    for line_no in range(1, total_lines + 1):
        assert line_no in covered, f"line {line_no} not covered by any chunk"


def test_chunk_content_matches_line_range():
    """청크 content의 실제 라인 수는 (end_line - start_line + 1)과 같아야 한다."""
    content = "\n".join(f"line {i}" for i in range(1, 601))
    chunks = chunk_file(FILE, content)

    for chunk in chunks:
        actual_lines = len(chunk.content.splitlines())
        expected_lines = chunk.end_line - chunk.start_line + 1
        assert actual_lines == expected_lines, (
            f"chunk[{chunk.chunk_index}]: actual={actual_lines} expected={expected_lines}"
        )


def test_file_path_preserved_in_chunks():
    """모든 청크는 원본 file_path를 그대로 유지해야 한다."""
    content = "\n".join(f"line {i}" for i in range(1, 1001))
    chunks = chunk_file(FILE, content)

    assert all(c.file_path == FILE for c in chunks)


def test_301_line_file_creates_multiple_chunks():
    """301 라인 파일은 임계값(300)을 초과했으므로 2개 이상의 청크로 분할돼야 한다."""
    content = "\n".join(f"line {i}" for i in range(1, 302))  # 301 라인
    chunks = chunk_file(FILE, content)

    assert len(chunks) >= 2
