#!/usr/bin/env bash
# fetch.sh — OWASP BenchmarkJava 데이터셋 클론 스크립트
#
# 사용법:
#   bash apps/ai_engine/eval/owasp_benchmark/fetch.sh
#   make eval-fetch
#
# 동작:
#   - BenchmarkJava 고정 태그(BENCHMARK_TAG)를 clone --depth=1 로 가져온다.
#   - 이미 존재하면 git fetch + checkout으로 업데이트한다.
#   - 실패 시 비0 종료.
#
# 준수:
#   - API 키/토큰을 로그에 출력하지 않는다.
#   - 목적지 경로는 스크립트 위치 기준 고정 (경로 순회 방어).

set -euo pipefail

# ── 상수 ─────────────────────────────────────────────────────────────────────

# BenchmarkJava 고정 태그 (runner.py BENCHMARK_TAG 와 동기화)
readonly BENCHMARK_TAG="1.2beta"
readonly BENCHMARK_REPO="https://github.com/OWASP-Benchmark/BenchmarkJava.git"

# 스크립트 위치 기준 절대 경로 (심볼릭 링크 없이)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly DEST_DIR="${SCRIPT_DIR}/BenchmarkJava"

# ── 함수 ─────────────────────────────────────────────────────────────────────

log() {
    echo "[fetch] $*"
}

err() {
    echo "[fetch] ERROR: $*" >&2
}

check_git() {
    if ! command -v git &>/dev/null; then
        err "git 명령을 찾을 수 없습니다. git을 설치 후 다시 실행하세요."
        exit 1
    fi
}

clone_fresh() {
    log "BenchmarkJava ${BENCHMARK_TAG} 클론 시작..."
    log "  대상: ${DEST_DIR}"
    git clone \
        --depth=1 \
        --branch "${BENCHMARK_TAG}" \
        "${BENCHMARK_REPO}" \
        "${DEST_DIR}"
    log "클론 완료."
}

update_existing() {
    log "BenchmarkJava 이미 존재합니다. 업데이트 시도..."
    cd "${DEST_DIR}"

    # 현재 태그/브랜치 확인
    current_tag=$(git describe --tags --exact-match 2>/dev/null || echo "unknown")
    if [ "${current_tag}" = "${BENCHMARK_TAG}" ]; then
        log "이미 최신 태그(${BENCHMARK_TAG})입니다. 재클론 불필요."
        return 0
    fi

    log "  현재: ${current_tag} → 대상: ${BENCHMARK_TAG}"
    git fetch --depth=1 origin "tags/${BENCHMARK_TAG}"
    git checkout "${BENCHMARK_TAG}"
    log "업데이트 완료."
}

verify_csv() {
    local csv_found=0
    # 루트 또는 scorecard 서브디렉터리에서 expectedresults*.csv 탐색
    if ls "${DEST_DIR}"/expectedresults*.csv &>/dev/null; then
        csv_found=1
    elif ls "${DEST_DIR}"/scorecard/expectedresults*.csv &>/dev/null; then
        csv_found=1
    fi

    if [ "${csv_found}" -eq 0 ]; then
        err "expectedresults*.csv 파일을 찾을 수 없습니다."
        err "  레포 구조가 변경됐을 수 있습니다: ${DEST_DIR}"
        exit 1
    fi
    log "expectedresults CSV 확인 완료."
}

# ── 메인 ─────────────────────────────────────────────────────────────────────

main() {
    log "=== OWASP BenchmarkJava 데이터셋 fetch ==="
    log "  태그: ${BENCHMARK_TAG}"
    log "  레포: ${BENCHMARK_REPO}"

    check_git

    if [ -d "${DEST_DIR}/.git" ]; then
        update_existing
    elif [ -d "${DEST_DIR}" ]; then
        err "${DEST_DIR} 가 존재하지만 git 레포가 아닙니다."
        err "  삭제 후 다시 실행하세요: rm -rf ${DEST_DIR}"
        exit 1
    else
        clone_fresh
    fi

    verify_csv
    log "=== fetch 완료 ==="
    log ""
    log "다음 명령으로 평가를 실행하세요:"
    log "  make eval LIMIT=100   # 빠른 샘플 실행"
    log "  make eval             # 풀런 (야간 권장)"
}

main "$@"
