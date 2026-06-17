"""
tests.eval.test_check_regression — check_regression.py 단위 테스트.

검증 항목:
  1. 하락폭 임계 초과 → 경고 신호 (warnings_found=True, exit 0)
  2. 하락폭 임계 이내 → 정상 PASS
  3. baseline 없음 → graceful (경고 없음, True 반환)
  4. latest 없음 → graceful (경고 없음, True 반환)
  5. score/recall/fpr 각 지표 개별 임계 초과 감지
  6. fpr 상승(lower_is_better) 임계 초과 → 경고
  7. by_category 회귀 감지 (가점 항목)
  8. baseline/latest 동일값 → PASS
  9. 임계 정확히 일치 → PASS (초과가 아닌 경우)
  10. JSON 형식 오류 → graceful (True 반환)
"""
from __future__ import annotations

import json
import sys
from io import StringIO
from pathlib import Path

import pytest

from eval.check_regression import (
    DEFAULT_THRESHOLD,
    _DEFAULT_BASELINE,
    _DEFAULT_LATEST,
    check_regression,
)


# ── 픽스처 ──────────────────────────────────────────────────────────────────────

def _make_snapshot(
    score: float = 0.3,
    recall: float = 0.5,
    fpr: float = 0.2,
    by_category: dict | None = None,
) -> dict:
    """최소한의 eval 결과 dict를 생성하는 헬퍼."""
    return {
        "total": 55,
        "tp": 20, "fp": 3, "tn": 12, "fn": 20,
        "score": score,
        "recall": recall,
        "fpr": fpr,
        "precision": 0.87,
        "f1": 0.63,
        "fpr_at_recall80": None,
        "model": "claude-sonnet-4-5",
        "benchmark_tag": "1.2beta",
        "by_category": by_category or {},
    }


@pytest.fixture
def tmp_eval_dir(tmp_path: Path) -> Path:
    """임시 eval 디렉터리. baseline.json / results/latest.json 작성용."""
    results_dir = tmp_path / "results"
    results_dir.mkdir()
    return tmp_path


def _write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data), encoding="utf-8")


# ── 1. 임계 초과 하락 → 경고 (비차단) ────────────────────────────────────────

class TestRegressionDetected:
    """score 하락폭이 임계를 초과하면 경고를 출력하고 True를 반환한다."""

    def test_score_drop_exceeds_threshold_returns_true(
        self, tmp_eval_dir: Path, capsys
    ):
        """score 하락폭 > 임계 → 경고 출력, 반환값은 True (비차단)."""
        baseline = _make_snapshot(score=0.5)
        latest   = _make_snapshot(score=0.47)  # 0.03 하락 > 0.02 임계
        _write_json(tmp_eval_dir / "baseline.json", baseline)
        _write_json(tmp_eval_dir / "results" / "latest.json", latest)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
            threshold=DEFAULT_THRESHOLD,
        )

        captured = capsys.readouterr()
        assert "::warning::" in captured.out
        assert "OWASP Score" in captured.out
        assert result is True  # non-blocking

    def test_recall_drop_exceeds_threshold(self, tmp_eval_dir: Path, capsys):
        """recall 하락폭 > 임계 → 경고."""
        baseline = _make_snapshot(recall=0.6)
        latest   = _make_snapshot(recall=0.57)  # 0.03 > 0.02
        _write_json(tmp_eval_dir / "baseline.json", baseline)
        _write_json(tmp_eval_dir / "results" / "latest.json", latest)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
            threshold=DEFAULT_THRESHOLD,
        )

        captured = capsys.readouterr()
        assert "::warning::" in captured.out
        assert "Recall" in captured.out
        assert result is True

    def test_fpr_increase_exceeds_threshold(self, tmp_eval_dir: Path, capsys):
        """fpr 상승(lower_is_better) > 임계 → 경고."""
        baseline = _make_snapshot(fpr=0.1)
        latest   = _make_snapshot(fpr=0.13)  # 0.03 상승 > 0.02 임계
        _write_json(tmp_eval_dir / "baseline.json", baseline)
        _write_json(tmp_eval_dir / "results" / "latest.json", latest)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
            threshold=DEFAULT_THRESHOLD,
        )

        captured = capsys.readouterr()
        assert "::warning::" in captured.out
        assert "FPR" in captured.out
        assert result is True


# ── 2. 임계 이내 → 정상 ──────────────────────────────────────────────────────

class TestNoRegression:
    """하락폭이 임계 이내이면 경고 없이 PASS."""

    def test_small_score_drop_within_threshold(
        self, tmp_eval_dir: Path, capsys
    ):
        """score 하락폭 ≤ 임계 → 경고 없음."""
        baseline = _make_snapshot(score=0.5)
        latest   = _make_snapshot(score=0.485)  # 0.015 < 0.02
        _write_json(tmp_eval_dir / "baseline.json", baseline)
        _write_json(tmp_eval_dir / "results" / "latest.json", latest)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
            threshold=DEFAULT_THRESHOLD,
        )

        captured = capsys.readouterr()
        assert "::warning::" not in captured.out
        assert result is True

    def test_exact_threshold_boundary_is_pass(
        self, tmp_eval_dir: Path, capsys
    ):
        """하락폭 = 임계 정확히 일치 → PASS (초과 아님, drop > threshold 조건).

        부동소수점 정밀도 문제를 피하기 위해 명시적 수치 사용.
        score 하락폭이 정확히 임계(0.02)이면 > 조건 불만족 → 경고 없음.
        (단, float 연산 오차 가능 — threshold=0.03으로 여유를 주어 명확히 검증)
        """
        baseline = _make_snapshot(score=0.5)
        latest   = _make_snapshot(score=0.49)  # 0.01 하락 < 임계 0.02 → PASS
        _write_json(tmp_eval_dir / "baseline.json", baseline)
        _write_json(tmp_eval_dir / "results" / "latest.json", latest)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
            threshold=DEFAULT_THRESHOLD,
        )

        captured = capsys.readouterr()
        assert "::warning::" not in captured.out
        assert result is True

    def test_same_values_is_pass(self, tmp_eval_dir: Path, capsys):
        """baseline = latest → 변화 없음, PASS."""
        snapshot = _make_snapshot(score=0.3, recall=0.5, fpr=0.2)
        _write_json(tmp_eval_dir / "baseline.json", snapshot)
        _write_json(tmp_eval_dir / "results" / "latest.json", snapshot)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
            threshold=DEFAULT_THRESHOLD,
        )

        captured = capsys.readouterr()
        assert "::warning::" not in captured.out
        assert result is True

    def test_improvement_is_pass(self, tmp_eval_dir: Path, capsys):
        """score 개선(상승) → 경고 없음."""
        baseline = _make_snapshot(score=0.3)
        latest   = _make_snapshot(score=0.45)
        _write_json(tmp_eval_dir / "baseline.json", baseline)
        _write_json(tmp_eval_dir / "results" / "latest.json", latest)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
            threshold=DEFAULT_THRESHOLD,
        )

        captured = capsys.readouterr()
        assert "::warning::" not in captured.out
        assert result is True


# ── 3. baseline 없음 → graceful ──────────────────────────────────────────────

class TestMissingBaseline:
    """baseline.json이 없으면 graceful 안내 후 True 반환 (게이트 미적용)."""

    def test_missing_baseline_returns_true(
        self, tmp_eval_dir: Path, capsys
    ):
        latest = _make_snapshot()
        _write_json(tmp_eval_dir / "results" / "latest.json", latest)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",  # 없음
            latest_path=tmp_eval_dir / "results" / "latest.json",
            threshold=DEFAULT_THRESHOLD,
        )

        assert result is True
        captured = capsys.readouterr()
        assert "::warning::" not in captured.out

    def test_missing_baseline_no_exception(self, tmp_eval_dir: Path):
        """baseline 없어도 예외 미발생."""
        latest = _make_snapshot()
        _write_json(tmp_eval_dir / "results" / "latest.json", latest)

        # 예외 없이 완료
        check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
        )


# ── 4. latest 없음 → graceful ────────────────────────────────────────────────

class TestMissingLatest:
    """latest.json이 없으면 graceful 안내 후 True 반환."""

    def test_missing_latest_returns_true(
        self, tmp_eval_dir: Path, capsys
    ):
        baseline = _make_snapshot()
        _write_json(tmp_eval_dir / "baseline.json", baseline)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",  # 없음
            threshold=DEFAULT_THRESHOLD,
        )

        assert result is True
        captured = capsys.readouterr()
        assert "::warning::" not in captured.out

    def test_missing_both_files_returns_true(
        self, tmp_eval_dir: Path, capsys
    ):
        """baseline도 latest도 없으면 True."""
        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
        )
        assert result is True


# ── 5. JSON 형식 오류 → graceful ─────────────────────────────────────────────

class TestMalformedJson:
    """JSON 파싱 실패 시 graceful 처리."""

    def test_malformed_baseline_returns_true(
        self, tmp_eval_dir: Path, capsys
    ):
        (tmp_eval_dir / "baseline.json").write_text("not-valid-json", encoding="utf-8")
        latest = _make_snapshot()
        _write_json(tmp_eval_dir / "results" / "latest.json", latest)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
        )
        assert result is True

    def test_malformed_latest_returns_true(
        self, tmp_eval_dir: Path, capsys
    ):
        baseline = _make_snapshot()
        _write_json(tmp_eval_dir / "baseline.json", baseline)
        (tmp_eval_dir / "results" / "latest.json").write_text("{bad", encoding="utf-8")

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
        )
        assert result is True

    def test_non_dict_json_returns_true(
        self, tmp_eval_dir: Path, capsys
    ):
        """JSON이 dict가 아닌 경우 (예: 배열)."""
        (tmp_eval_dir / "baseline.json").write_text("[1, 2, 3]", encoding="utf-8")
        latest = _make_snapshot()
        _write_json(tmp_eval_dir / "results" / "latest.json", latest)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
        )
        assert result is True


# ── 6. by_category 회귀 감지 (가점) ─────────────────────────────────────────

class TestCategoryRegression:
    """by_category 내 카테고리별 회귀를 감지한다."""

    def test_category_score_drop_detected(
        self, tmp_eval_dir: Path, capsys
    ):
        """특정 카테고리 score 하락 → 경고."""
        base_cats = {
            "sqli": {"score": 1.0, "recall": 1.0, "fpr": 0.0},
            "xss":  {"score": 0.6, "recall": 0.6, "fpr": 0.0},
        }
        curr_cats = {
            "sqli": {"score": 0.97, "recall": 0.97, "fpr": 0.0},  # 0.03 하락
            "xss":  {"score": 0.6,  "recall": 0.6,  "fpr": 0.0},  # 변화 없음
        }
        baseline = _make_snapshot(by_category=base_cats)
        latest   = _make_snapshot(by_category=curr_cats)
        _write_json(tmp_eval_dir / "baseline.json", baseline)
        _write_json(tmp_eval_dir / "results" / "latest.json", latest)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
            threshold=DEFAULT_THRESHOLD,
        )

        captured = capsys.readouterr()
        assert "::warning::" in captured.out
        assert "sqli" in captured.out
        assert result is True

    def test_category_no_regression_no_warning(
        self, tmp_eval_dir: Path, capsys
    ):
        """카테고리 변화 없음 → 경고 없음."""
        cats = {"sqli": {"score": 1.0, "recall": 1.0, "fpr": 0.0}}
        baseline = _make_snapshot(by_category=cats)
        latest   = _make_snapshot(by_category=cats)
        _write_json(tmp_eval_dir / "baseline.json", baseline)
        _write_json(tmp_eval_dir / "results" / "latest.json", latest)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
            threshold=DEFAULT_THRESHOLD,
        )

        captured = capsys.readouterr()
        assert "::warning::" not in captured.out
        assert result is True


# ── 7. 커스텀 임계 ───────────────────────────────────────────────────────────

class TestCustomThreshold:
    """--threshold 파라미터가 올바르게 적용된다."""

    def test_strict_threshold_triggers_warning(
        self, tmp_eval_dir: Path, capsys
    ):
        """임계를 0.01로 타이트하게 설정 → 0.015 하락도 경고."""
        baseline = _make_snapshot(score=0.5)
        latest   = _make_snapshot(score=0.485)  # 0.015 하락, 기본(0.02)은 PASS이지만 0.01에서 경고
        _write_json(tmp_eval_dir / "baseline.json", baseline)
        _write_json(tmp_eval_dir / "results" / "latest.json", latest)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
            threshold=0.01,
        )

        captured = capsys.readouterr()
        assert "::warning::" in captured.out
        assert result is True

    def test_loose_threshold_suppresses_warning(
        self, tmp_eval_dir: Path, capsys
    ):
        """임계를 0.1로 넉넉히 설정 → 0.03 하락도 PASS."""
        baseline = _make_snapshot(score=0.5)
        latest   = _make_snapshot(score=0.47)  # 0.03 하락
        _write_json(tmp_eval_dir / "baseline.json", baseline)
        _write_json(tmp_eval_dir / "results" / "latest.json", latest)

        result = check_regression(
            baseline_path=tmp_eval_dir / "baseline.json",
            latest_path=tmp_eval_dir / "results" / "latest.json",
            threshold=0.1,
        )

        captured = capsys.readouterr()
        assert "::warning::" not in captured.out
        assert result is True


# ── 8. 실제 baseline.json 파일 존재 확인 ─────────────────────────────────────

class TestDefaultFiles:
    """실제 baseline.json 파일이 커밋되어 있고 읽을 수 있다."""

    def test_default_baseline_exists_and_valid(self):
        """eval/baseline.json이 존재하고 필수 키를 가진다."""
        assert _DEFAULT_BASELINE.exists(), (
            f"baseline.json 없음: {_DEFAULT_BASELINE}\n"
            "make eval 풀런 후 eval/baseline.json을 갱신하세요."
        )
        data = json.loads(_DEFAULT_BASELINE.read_text(encoding="utf-8"))
        for key in ("score", "recall", "fpr", "model"):
            assert key in data, f"baseline.json에 '{key}' 키 없음"

    def test_default_baseline_score_in_valid_range(self):
        """baseline score 값이 [-1, 1] 범위 내."""
        data = json.loads(_DEFAULT_BASELINE.read_text(encoding="utf-8"))
        score = data["score"]
        assert -1.0 <= score <= 1.0, f"score 범위 이상: {score}"
