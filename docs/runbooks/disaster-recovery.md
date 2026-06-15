# Disaster Recovery Runbook — SecureAI Engine

## 한 줄 요약
RTO 4h / RPO 24h. 일 1회 자동 백업(03:00 KST) → S3 보관 → pg_restore 로 복원.

---

## 목표 지표 (SLA)

| 지표 | 목표값 | 비고 |
|------|--------|------|
| **RTO** (복구 목표 시간) | **4시간** | 백업 다운로드 + DB 복원 + 서비스 기동 포함 |
| **RPO** (복구 목표 지점) | **24시간** | 매일 03:00 KST 백업 → 최대 24h 데이터 손실 가능 |

---

## 백업 아키텍처

```
[PostgreSQL DB]
      │ 03:00 KST 매일
      ▼
[backup-postgres.sh]  (pg_dump --format=custom | gzip)
      │
      ▼
[S3 버킷 postgres/secureai_{db}_{TIMESTAMP}.dump.gz]
      │ 30일 후
      ▼
[S3 Glacier]
      │ 365일 후
      ▼
[자동 삭제]
```

**S3 버킷 보안 전제조건:**
- Block Public Access **전체 활성화** 필수 (아래 확인 절차 참고)
- 버킷 정책: 백업 IAM 역할만 `s3:PutObject` / `s3:GetObject` 허용
- 서버 측 암호화: SSE-S3 또는 SSE-KMS 활성화

---

## 사전 요구사항

| 항목 | 비고 |
|------|------|
| `pg_restore` 설치 | `apt install postgresql-client` |
| AWS CLI 설치 및 자격증명 | `aws configure` 또는 IAM 역할 |
| 복원 대상 PostgreSQL 인스턴스 | 동일 버전 권장 (dump 호환성) |
| 네트워크 접근 | S3 버킷 + 복원 대상 DB |

---

## 복구 절차

### Step 1: S3 Block Public Access 확인 (필수)

```bash
aws s3api get-public-access-block --bucket <S3_BUCKET_NAME>
```

예상 출력 — 모든 항목이 `true` 여야 한다:
```json
{
    "PublicAccessBlockConfiguration": {
        "BlockPublicAcls": true,
        "IgnorePublicAcls": true,
        "BlockPublicPolicy": true,
        "RestrictPublicBuckets": true
    }
}
```

`false` 항목이 있으면 즉시 차단:
```bash
aws s3api put-public-access-block \
  --bucket <S3_BUCKET_NAME> \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### Step 2: 복구 지점 결정 (RPO 24h 이내)

```bash
# 복원할 백업 파일 목록 확인
aws s3 ls s3://<S3_BUCKET_NAME>/postgres/ --recursive | sort -k1,2 | tail -10
```

출력 예시:
```
2026-06-14 18:00:05  123456789 postgres/secureai_secureai_20260614T180000Z.dump.gz
2026-06-15 18:00:08  123521000 postgres/secureai_secureai_20260615T180000Z.dump.gz
```

RPO 24h 기준: 직전 24시간 내 최신 파일을 선택한다.

### Step 3: 백업 파일 다운로드

```bash
# 로컬 작업 디렉터리 생성
mkdir -p /tmp/secureai-restore
cd /tmp/secureai-restore

# S3 에서 다운로드 (Glacier 이관된 경우 복원 요청 필요 — 아래 참고)
aws s3 cp s3://<S3_BUCKET_NAME>/postgres/secureai_secureai_<TIMESTAMP>.dump.gz .
```

**Glacier 이관된 파일 복원 요청 (30일 초과 파일):**
```bash
aws s3api restore-object \
  --bucket <S3_BUCKET_NAME> \
  --key "postgres/secureai_secureai_<TIMESTAMP>.dump.gz" \
  --restore-request '{"Days":3,"GlacierJobParameters":{"Tier":"Standard"}}'
# Glacier Standard 복원: 3~5시간 소요 → RTO 영향 주의
```

### Step 4: 압축 해제

```bash
gunzip secureai_secureai_<TIMESTAMP>.dump.gz
# 결과: secureai_secureai_<TIMESTAMP>.dump (pg_dump custom 포맷)
```

### Step 5: 복원 대상 DB 준비

```bash
# 기존 DB 삭제 (주의: 되돌릴 수 없음 — 사전에 현재 상태 추가 백업 권장)
psql -h <RESTORE_HOST> -U <PGUSER> -c "DROP DATABASE IF EXISTS secureai_restore;"
psql -h <RESTORE_HOST> -U <PGUSER> -c "CREATE DATABASE secureai_restore;"
```

### Step 6: pg_restore 실행

```bash
pg_restore \
  --host=<RESTORE_HOST> \
  --port=<RESTORE_PORT> \
  --username=<PGUSER> \
  --dbname=secureai_restore \
  --verbose \
  --no-password \
  secureai_secureai_<TIMESTAMP>.dump
```

> PGPASSWORD 환경변수로 비밀번호 주입: `export PGPASSWORD=<password>`
> 비밀번호는 터미널 히스토리 / 로그에 노출되지 않도록 env 주입 사용.

### Step 7: 데이터 동일성 검증

```bash
# 복원된 DB 행 수 샘플 확인
psql -h <RESTORE_HOST> -U <PGUSER> -d secureai_restore -c "
  SELECT
    (SELECT COUNT(*) FROM users)       AS users,
    (SELECT COUNT(*) FROM projects)    AS projects,
    (SELECT COUNT(*) FROM analyses)    AS analyses,
    (SELECT COUNT(*) FROM findings)    AS findings;
"
```

원본 DB 수치와 비교하여 동일하면 복원 성공.

### Step 8: 서비스 절체 (프로덕션 복원 시)

```bash
# 1. 기존 서비스 중단
docker compose down backend ai_engine

# 2. docker-compose.yml 의 DB 연결 정보를 복원 DB 로 변경

# 3. 서비스 재기동
docker compose up -d backend ai_engine

# 4. 헬스체크 확인
curl http://localhost:8080/actuator/health
```

---

## 수동 백업 즉시 실행

`BackupJob` 스케줄을 기다리지 않고 즉시 실행이 필요한 경우:

```bash
# 환경변수 설정 후 스크립트 직접 실행
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=secureai
export PGUSER=secureai
export PGPASSWORD=<DB_PASSWORD>   # 터미널에서만, 로그 출력 금지
export S3_BUCKET=<BUCKET_NAME>

bash infra/scripts/backup-postgres.sh
```

---

## S3 라이프사이클 정책 적용

`infra/scripts/s3-lifecycle-policy.json` 참고:

```bash
# 라이프사이클 정책 적용
aws s3api put-bucket-lifecycle-configuration \
  --bucket <S3_BUCKET_NAME> \
  --lifecycle-configuration file://infra/scripts/s3-lifecycle-policy.json

# 적용 확인
aws s3api get-bucket-lifecycle-configuration --bucket <S3_BUCKET_NAME>
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `pg_dump: error: connection to server failed` | DB 접속 정보 오류 | PGHOST/PGPORT/PGUSER/PGPASSWORD 환경변수 확인 |
| `aws: command not found` | AWS CLI 미설치 | `pip install awscli` 또는 패키지 관리자 설치 |
| `NoCredentialsError` | AWS 자격증명 없음 | `aws configure` 또는 IAM 역할 연결 확인 |
| S3 업로드 `AccessDenied` | IAM 권한 부족 | IAM 역할에 `s3:PutObject` 권한 추가 |
| `pg_restore: error: input file is too short` | 파일 손상 또는 불완전 다운로드 | S3 에서 재다운로드, MD5 체크섬 비교 |
| Glacier 파일 접근 불가 | Glacier 복원 미완료 | `aws s3api head-object` 로 복원 상태 확인 후 대기 |
| `BackupJob` 이 실행되지 않음 | `backup.enabled=false` | 환경변수 `BACKUP_ENABLED=true` 설정 + 서비스 재기동 |

---

## 백업 상태 모니터링

`BackupJob` 실행 결과는 애플리케이션 로그에서 확인:
```
[backup] 자동 백업 시작
[backup-script] pg_dump 완료: /tmp/secureai-backup/secureai_secureai_20260615T180000Z.dump.gz
[backup-script] S3 업로드 완료: s3://bucket/postgres/secureai_secureai_20260615T180000Z.dump.gz
[backup] 자동 백업 완료
```

실패 시:
```
[backup] 자동 백업 실패 — 원인: backup-postgres.sh 비정상 종료 (exit=1)
```

Loki + Grafana 에서 `{app="backend"} |= "[backup]"` 쿼리로 조회 가능.

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `infra/scripts/backup-postgres.sh` | pg_dump + S3 업로드 셸 스크립트 |
| `infra/scripts/s3-lifecycle-policy.json` | S3 라이프사이클 IaC 정책 |
| `apps/backend/.../domain/backup/service/BackupJob.java` | Spring 스케줄 잡 (매일 03:00 KST) |
