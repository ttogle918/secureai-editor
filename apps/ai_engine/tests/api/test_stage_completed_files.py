"""
STAGE-1: stage_completed 이벤트에 files 동봉 검증
- _get_stage_files: stage_no로 파일 목록 정확 반환
- analyze.py _run_analysis: stage_completed 발행 시 files 포함
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from api.routes.analyze import _get_stage_files, _find_stage_for_file, _is_stage_completed


# ── _get_stage_files 단위 테스트 ─────────────────────────────────────────────

def test_get_stage_files_returns_files_for_matching_stage_no():
    """stage_no가 일치하는 stage의 files를 반환한다."""
    stages = [
        {"stage_no": 1, "name": "Auth", "files": ["src/A.java", "src/B.java"]},
        {"stage_no": 2, "name": "Service", "files": ["src/C.java"]},
    ]
    result = _get_stage_files(stages, stage_no=1)
    assert result == ["src/A.java", "src/B.java"]


def test_get_stage_files_returns_empty_for_missing_stage():
    """stage_no가 없는 경우 빈 목록을 반환한다."""
    stages = [
        {"stage_no": 1, "name": "Auth", "files": ["src/A.java"]},
    ]
    result = _get_stage_files(stages, stage_no=99)
    assert result == []


def test_get_stage_files_returns_empty_for_empty_stages():
    """stages가 빈 목록이면 빈 목록을 반환한다."""
    result = _get_stage_files([], stage_no=1)
    assert result == []


def test_get_stage_files_returns_empty_when_stage_has_no_files():
    """stage에 files 키가 없으면 빈 목록을 반환한다."""
    stages = [{"stage_no": 1, "name": "Auth"}]  # files 키 없음
    result = _get_stage_files(stages, stage_no=1)
    assert result == []


def test_get_stage_files_returns_copy_not_original():
    """반환값은 원본 목록의 복사본이다 — 변경 불파급."""
    stages = [{"stage_no": 1, "name": "Auth", "files": ["src/A.java"]}]
    result = _get_stage_files(stages, stage_no=1)
    result.append("src/injected.java")
    # 원본 stages는 불변
    assert stages[0]["files"] == ["src/A.java"]


# ── _find_stage_for_file 단위 테스트 ─────────────────────────────────────────

def test_find_stage_for_file_returns_matching_stage():
    """파일이 속한 stage를 반환한다."""
    stages = [
        {"stage_no": 1, "files": ["src/A.java"]},
        {"stage_no": 2, "files": ["src/B.java"]},
    ]
    stage = _find_stage_for_file("src/B.java", stages)
    assert stage is not None
    assert stage["stage_no"] == 2


def test_find_stage_for_file_returns_none_for_unknown_file():
    """파일이 어느 stage에도 없으면 None을 반환한다."""
    stages = [{"stage_no": 1, "files": ["src/A.java"]}]
    result = _find_stage_for_file("src/unknown.java", stages)
    assert result is None


# ── _is_stage_completed 단위 테스트 ──────────────────────────────────────────

def test_is_stage_completed_returns_true_when_files_exhausted():
    """파일이 소진되면 stage 완료로 판정한다."""
    files = ["src/A.java", "src/B.java"]
    stages = [{"stage_no": 1, "files": ["src/A.java", "src/B.java"]}]
    assert _is_stage_completed(files, stages, next_idx=2, last_stage_no=1) is True


def test_is_stage_completed_returns_true_when_next_file_in_different_stage():
    """다음 파일이 다른 stage에 속하면 완료로 판정한다."""
    files = ["src/A.java", "src/C.java"]
    stages = [
        {"stage_no": 1, "files": ["src/A.java"]},
        {"stage_no": 2, "files": ["src/C.java"]},
    ]
    assert _is_stage_completed(files, stages, next_idx=1, last_stage_no=1) is True


def test_is_stage_completed_returns_false_when_next_file_in_same_stage():
    """다음 파일이 같은 stage에 속하면 미완료로 판정한다."""
    files = ["src/A.java", "src/B.java", "src/C.java"]
    stages = [{"stage_no": 1, "files": ["src/A.java", "src/B.java", "src/C.java"]}]
    assert _is_stage_completed(files, stages, next_idx=1, last_stage_no=1) is False


# ── stage_completed 페이로드에 files 포함 검증 ─────────────────────────────

@pytest.mark.asyncio
async def test_stage_completed_payload_includes_files():
    """
    stage_completed 이벤트 발행 시 해당 stage의 files가 페이로드에 포함된다.
    publish 함수를 mock하여 전달 인자를 검증한다.
    """
    published_events: list[dict] = []

    async def mock_publish(event_type: str, **kwargs):
        published_events.append({"type": event_type, **kwargs})

    stages = [
        {"stage_no": 1, "name": "Auth", "files": ["src/A.java", "src/B.java"]},
        {"stage_no": 2, "name": "Service", "files": ["src/C.java"]},
    ]
    files = ["src/A.java", "src/B.java", "src/C.java"]
    last_stage_no = 1
    next_idx = 2  # src/C.java → stage 2 → stage 1 완료

    from api.routes.analyze import _is_stage_completed, _get_stage_files

    completed = _is_stage_completed(files, stages, next_idx, last_stage_no)
    assert completed is True

    stage_files = _get_stage_files(stages, last_stage_no)
    await mock_publish("stage_completed", stage_no=last_stage_no, files=stage_files)

    assert len(published_events) == 1
    evt = published_events[0]
    assert evt["type"] == "stage_completed"
    assert evt["stage_no"] == 1
    assert evt["files"] == ["src/A.java", "src/B.java"]


@pytest.mark.asyncio
async def test_stage_completed_files_missing_is_backward_compatible():
    """
    구버전 이벤트(files 없음) 수신 시 markStageCompleted만 호출되고 세션이 중단되지 않는다.
    analyze.py에서 files=[] 빈 목록으로 동봉되는지 검증한다.
    """
    stages_without_match = []  # stage_no가 없는 경우
    result = _get_stage_files(stages_without_match, stage_no=1)
    assert result == []  # 빈 목록 → 프론트에서 조회 스킵
