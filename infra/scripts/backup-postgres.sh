#!/usr/bin/env bash
# backup-postgres.sh
# pg_dump → gzip → S3 업로드
#
# 필수 환경변수:
#   PGHOST        PostgreSQL 호스트
#   PGPORT        PostgreSQL 포트 (기본 5432)
#   PGDATABASE    덤프 대상 데이터베이스 이름
#   PGUSER        PostgreSQL 사용자
#   PGPASSWORD    PostgreSQL 비밀번호 (이 스크립트에 하드코딩 금지 — env 주입 전용)
#   S3_BUCKET     업로드 대상 S3 버킷 이름 (예: my-backup-bucket)
#   S3_PREFIX     S3 키 접두사 (기본 "postgres/")
#
# 선택 환경변수:
#   BACKUP_TMP_DIR  임시 파일 저장 디렉터리 (기본 /tmp/secureai-backup)

set -euo pipefail

# ---------- 상수 ----------
readonly DEFAULT_PGPORT="5432"
readonly DEFAULT_S3_PREFIX="postgres/"
readonly DEFAULT_BACKUP_TMP_DIR="/tmp/secureai-backup"
readonly TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")

# ---------- 환경변수 검증 ----------
check_required_env() {
    local missing=0
    for var in PGHOST PGDATABASE PGUSER PGPASSWORD S3_BUCKET; do
        if [ -z "${!var:-}" ]; then
            echo "[backup] ERROR: 필수 환경변수 '${var}' 가 설정되지 않았습니다." >&2
            missing=1
        fi
    done
    return $missing
}

# ---------- 의존 도구 확인 ----------
check_dependencies() {
    for cmd in pg_dump gzip aws; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            echo "[backup] ERROR: 필수 도구 '${cmd}' 가 설치되지 않았습니다." >&2
            return 1
        fi
    done
}

# ---------- 임시 디렉터리 생성 ----------
prepare_tmp_dir() {
    local tmp_dir="${BACKUP_TMP_DIR:-$DEFAULT_BACKUP_TMP_DIR}"
    # 경로 순회 방어: 절대경로 검증
    case "$tmp_dir" in
        /*) : ;;  # 절대경로만 허용
        *)
            echo "[backup] ERROR: BACKUP_TMP_DIR 는 절대경로여야 합니다." >&2
            return 1
            ;;
    esac
    mkdir -p "$tmp_dir"
    echo "$tmp_dir"
}

# ---------- pg_dump 실행 ----------
run_pg_dump() {
    local output_file="$1"
    local port="${PGPORT:-$DEFAULT_PGPORT}"

    # PGPASSWORD 는 환경변수로만 전달 — 명령줄 인수에 포함 금지
    if ! pg_dump \
        --host="$PGHOST" \
        --port="$port" \
        --username="$PGUSER" \
        --dbname="$PGDATABASE" \
        --format=custom \
        --no-password \
        | gzip > "$output_file"; then
        echo "[backup] ERROR: pg_dump 실패 (host=${PGHOST}, db=${PGDATABASE})" >&2
        return 1
    fi
    echo "[backup] pg_dump 완료: ${output_file}"
}

# ---------- S3 업로드 ----------
upload_to_s3() {
    local local_file="$1"
    local prefix="${S3_PREFIX:-$DEFAULT_S3_PREFIX}"
    local filename
    filename=$(basename "$local_file")
    local s3_key="${prefix}${filename}"
    local s3_uri="s3://${S3_BUCKET}/${s3_key}"

    # AWS 자격증명은 환경변수(AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / IAM 역할)로 주입
    if ! aws s3 cp "$local_file" "$s3_uri" --no-progress; then
        echo "[backup] ERROR: S3 업로드 실패 → ${s3_uri}" >&2
        return 1
    fi
    echo "[backup] S3 업로드 완료: ${s3_uri}"
}

# ---------- 임시 파일 정리 ----------
cleanup_tmp_file() {
    local file="$1"
    if [ -f "$file" ]; then
        rm -f "$file"
        echo "[backup] 임시 파일 삭제: ${file}"
    fi
}

# ---------- 메인 ----------
main() {
    echo "[backup] PostgreSQL 백업 시작 (UTC ${TIMESTAMP})"

    check_required_env || exit 1
    check_dependencies || exit 1

    local tmp_dir
    tmp_dir=$(prepare_tmp_dir) || exit 1

    local backup_file="${tmp_dir}/secureai_${PGDATABASE}_${TIMESTAMP}.dump.gz"

    # trap: 스크립트 종료(정상/비정상) 시 임시 파일 보장 정리
    trap 'cleanup_tmp_file "$backup_file"' EXIT

    run_pg_dump "$backup_file" || exit 1
    upload_to_s3 "$backup_file" || exit 1

    echo "[backup] 백업 완료 (UTC ${TIMESTAMP})"
}

main "$@"
