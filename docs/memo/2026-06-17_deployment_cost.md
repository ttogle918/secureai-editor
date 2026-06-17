# SecureAI Editor — 배포 비용 분석

> 기준: AWS (서울 리전 ap-northeast-2), 2026년 6월 시세 기준  
> docker-compose.yml / docker-compose.prod.yml 리소스 제한 수치 직접 참조

---

## 인프라 서비스 구성 요약

```
┌─────────────────────────────────────────────────────────┐
│  Nginx (443/80)                                         │
│  ├── Frontend  Next.js  (1 CPU / 512MB)                │
│  ├── Backend   Spring Boot (2 CPU / 2GB, ZGC)          │
│  └── AI Engine FastAPI (2 CPU / 2GB 권장)              │
│                                                         │
│  Data Layer                                             │
│  ├── PostgreSQL 15 + pgvector (1 CPU / 1GB)            │
│  └── Redis 7   maxmemory 512MB (0.5 CPU / 512MB)       │
│                                                         │
│  Observability (선택)                                   │
│  ├── Jaeger   (분산 트레이싱)                           │
│  ├── Prometheus + Grafana (메트릭/대시보드)             │
│  └── Loki + Promtail (로그 수집)                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🧪 1단계: 테스트 배포 (Staging)

### 목표
- 기능 동작 검증, 데모, QA
- 트래픽 거의 없음 (팀 내부 사용자 5명 이하)
- 고가용성 불필요, 단일 인스턴스

### 추천 구성: 단일 EC2 + RDS/ElastiCache (또는 All-in-One EC2)

#### 옵션 A: 단일 EC2 All-in-One (가장 저렴)
모든 서비스를 1대의 EC2에 Docker Compose로 실행

| 항목 | 사양 | 월 비용 |
|------|------|---------|
| EC2 `t3.xlarge` | 4 vCPU / 16GB RAM | $119 |
| EBS gp3 50GB | 스토리지 | $4 |
| Elastic IP | 고정 IP | $4 |
| 데이터 전송 | ~5GB/월 | $0.5 |
| **소계** | | **~$128/월** |

> `t3.xlarge` 기준: Backend(2GB) + AI Engine(2GB) + PG(1GB) + Redis(512MB) + Frontend + Observability ≈ 7~8GB 사용

> [!TIP]
> `t3.large` (8GB)로도 Observability 스택(Prometheus/Grafana/Jaeger/Loki) 제외하면 동작 가능 → **$67/월**

#### 옵션 B: EC2 + 관리형 DB (안정성 ↑)

| 항목 | 사양 | 월 비용 |
|------|------|---------|
| EC2 `t3.large` | 2 vCPU / 8GB | $67 |
| RDS PostgreSQL `db.t3.micro` | 1 vCPU / 1GB | $14 |
| ElastiCache Redis `cache.t3.micro` | 1 vCPU / 0.5GB | $12 |
| EBS gp3 30GB | 스토리지 | $2.4 |
| Elastic IP | | $4 |
| **소계** | | **~$100/월** |

---

### 테스트 환경 AI API 비용 (변동)

테스트 환경은 소량 사용이므로 추정이 어렵지만, 팀 내부 QA 기준:

| 항목 | 가정 | 월 비용 |
|------|------|---------|
| Claude Haiku (SAST/Patch) | 50회 분석 × 파일 10개 × 5K tokens | ~$3 |
| Claude (Secret Scan) | 20회 × 1K tokens | ~$0.5 |
| Claude (Chat) | 100턴 × 2K tokens | ~$1 |
| **소계** | | **~$5/월** |

### ✅ 테스트 배포 총 비용: **$105~$135/월** (약 14~18만원)

---

## 🚀 2단계: 프로덕션 배포

### 목표
- 실제 서비스, 동시 사용자 수십~수백명
- 고가용성 (AZ 이중화), 자동 스케일링
- 데이터 안전성 (백업, Multi-AZ RDS)

### 추천 구성: EKS 또는 EC2 Auto Scaling + 관리형 서비스

#### 구성도

```
Route 53 → ALB → EC2 Auto Scaling Group
                  ├── Backend (t3.large × 2~3)
                  └── AI Engine (t3.large × 2~3)

관리형 서비스
├── RDS PostgreSQL Multi-AZ (db.t3.medium)
├── ElastiCache Redis (cache.r7g.large)
├── S3 (보고서 PDF 저장)
└── CloudFront + S3 (Frontend 정적 배포) ← 권장
```

---

### 인프라 비용 (최소 프로덕션)

| 항목 | 사양 | 수량 | 월 비용 |
|------|------|------|---------|
| EC2 Backend `t3.large` | 2 vCPU / 8GB | 2대 | $134 |
| EC2 AI Engine `t3.large` | 2 vCPU / 8GB | 2대 | $134 |
| RDS PostgreSQL `db.t3.medium` Multi-AZ | 2 vCPU / 4GB | 1 | $97 |
| RDS 스토리지 100GB gp3 | | | $11.5 |
| ElastiCache Redis `cache.r7g.large` | 2 vCPU / 13GB | 1 | $119 |
| ALB (Application Load Balancer) | | 1 | $22 |
| CloudFront + S3 (Frontend) | 50GB 전송 | | $12 |
| EBS gp3 50GB × 4대 | | | $16 |
| NAT Gateway | | 1 | $45 |
| 데이터 전송 비용 | ~50GB | | $5 |
| **소계** | | | **~$596/월** |

> [!IMPORTANT]
> AI Engine은 LangGraph + Claude API 동시 요청이 많아 CPU/메모리 압박이 큼.  
> 분석 세션이 급증하면 **AI Engine만 t3.xlarge(4 vCPU/16GB)로 업그레이드**가 필요할 수 있음 → +$76/대

---

### AI API 비용 (가장 큰 변동 요인 ⚠️)

> [!CAUTION]
> **AI API 비용은 실사용량에 따라 인프라 비용보다 훨씬 커질 수 있습니다.**

#### 프로덕션 AI API 비용 추정 (월 활성 사용자 100명 기준)

| 항목 | 계산 | 월 비용 |
|------|------|---------|
| **SAST 분석** | 사용자 100명 × 월 5회 분석 × 파일 20개 × 평균 3K tokens | |
| → Claude Haiku | Input: 30M tokens ($0.80/1M) | $24 |
| → Claude Haiku | Output: 10M tokens ($4/1M) | $40 |
| **Prompt Cache (절감)** | SHA256 캐시 HIT율 40% 가정 | -$25 |
| **패치 생성** | 500개 취약점 × 5K tokens | $7 |
| **Secret Scan** | 200회 × 2K tokens | $2 |
| **AI 채팅** | 사용자 100명 × 50턴 × 2K tokens | $10 |
| **소계** | | **~$58~$150/월** |

> **스케일링 시나리오**: MAU 1,000명이면 ×10 → **$580~$1,500/월 AI 비용** 발생 가능

---

### 외부 서비스 비용

| 서비스 | 용도 | 월 비용 |
|--------|------|---------|
| 도메인 (Route 53) | DNS 호스팅 | $1 |
| SSL 인증서 | ACM (AWS) | **무료** |
| 이메일 발송 (SES) | 인증/알림 메일 10만건 | $10 |
| Sentry | 에러 추적 (Team 플랜) | $26 |
| LangSmith | LangGraph 트레이싱 (Plus) | $39 |
| GitHub App 등록 | | **무료** |
| Slack Webhook | 모니터링 알림 | **무료** |
| **소계** | | **~$76/월** |

---

### ✅ 프로덕션 총 비용 (MAU 100명 기준)

| 분류 | 월 비용 |
|------|---------|
| 인프라 (AWS) | ~$596 |
| AI API (Claude/Gemini/OpenAI) | ~$58~$150 |
| 외부 서비스 | ~$76 |
| **합계** | **$730~$822/월** (약 100~110만원) |

---

## 비용 비교 요약

```
┌─────────────────────────────────────────────────────────┐
│  테스트 환경  $105~$135/월  (14~18만원)                 │
│  ─────────────────────────────────────────────────────  │
│  프로덕션     $730~$822/월  (100~110만원) [MAU 100명]   │
│               $1,500~$2,500/월 [MAU 1,000명 예상]       │
└─────────────────────────────────────────────────────────┘
```

---

## 💡 비용 절감 포인트

### 즉시 적용 가능
1. **Spot 인스턴스** — AI Engine은 재시작 가능하므로 Spot 적용 시 **최대 70% 절감**
2. **Redis 캐시 히트율 극대화** — SHA256 캐시(현재 구현됨)로 동일 파일 재분석 방지
3. **Claude Prompt Caching** — system prompt cache_control이 코드에 이미 구현됨 → 캐시 히트 시 input token 비용 90% 절감
4. **Frontend → Vercel 무료 플랜** — Next.js는 Vercel 무료 tier로 배포 가능 (EC2 없이)
5. **Observability 스택 제거/축소** — Jaeger/Loki/Prometheus/Grafana는 프로덕션 초기 제외 가능 (월 ~$0 EC2 절감)

### 중기 전략
6. **Reserved Instance (1년)** — RDS/ElastiCache를 예약 구매 시 **40% 절감**
7. **Graviton3 (arm64) 인스턴스** — `t4g.large`로 교체 시 **20% 절감** (JVM/Python 모두 지원)
8. **파일 필터 분석 (현재 구현됨)** — `file_filter` 파라미터로 필요한 파일만 분석

### BYOK 수익화 모델과의 연계
> BYOK(사용자 본인 API 키) 기능이 이미 구현되어 있으므로,  
> 사용자가 본인 Claude/OpenAI 키를 등록하면 AI API 비용을 **사용자에게 전가**할 수 있음.  
> 이 경우 AI 비용이 인프라에서 분리되어 **서비스 비용을 $600~$650/월 수준으로 고정** 가능.

---

## 초기 배포 추천 경로

```
Phase 1: 테스트 배포 (1~2개월)
  → EC2 t3.xlarge 단일 서버 All-in-One
  → 월 $130
  → 목적: 기능 검증, 초기 사용자 피드백

Phase 2: 소규모 프로덕션 (MAU 50명 이하)
  → EC2 t3.large × 2 + RDS + ElastiCache
  → 월 $400~$500
  → Vercel로 Frontend 분리 → EC2 1대 절감

Phase 3: 본격 스케일 (MAU 100명+)
  → Auto Scaling 적용, Reserved Instance
  → 월 $700~$900
  → BYOK 사용자 비율에 따라 AI 비용 유동
```
