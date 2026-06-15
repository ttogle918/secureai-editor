# Grafana Loki 데이터소스 플러그인 크래시 루프

**날짜**: 2026-06-15
**브랜치**: feat/sprint12-phase2 (Stage 6)
**관련 커밋**: 795c1e0 (수정 포함), 머지 1d118a7

---

## 이슈 1 — Grafana 컨테이너 크래시 루프 (GF_INSTALL_PLUGINS 오설정)

### 증상

```
docker compose up -d grafana
secureai-grafana        Restarting (1) 15 seconds ago
```

- secureai-grafana 컨테이너가 무한 재시작 (Restarting(1))
- /api/health, 3000 포트 무응답
- Grafana 웹 UI 접근 불가

### 원인 분석

Grafana 로그 조회 시:

```
[plugin.backgroundinstaller] Failed to install plugins [grafana-loki-datasource] 
error=unknown status, status=404: Not Found, msg=Plugin not found
```

**근본 원인**:
- docker-compose.yml의 grafana 서비스에 `GF_INSTALL_PLUGINS=grafana-loki-datasource` 설정이 있음
- Grafana 13.x부터 **Loki는 빌트인 코어 데이터소스** (외부 플러그인 아님)
- 플러그인 설치 모듈(plugin.backgroundinstaller)이 레지스트리에서 찾을 수 없음 → 404 에러 → 서비스 시작 실패
- 초기화 실패 → 프로세스 종료 → 재시작 루프

### 해결

**적용 수정**:

docker-compose.yml의 grafana 서비스 environment 섹션에서 `GF_INSTALL_PLUGINS` 라인 **제거**

```yaml
services:
  grafana:
    image: grafana/grafana:13.2.0
    environment:
      # 제거됨: GF_INSTALL_PLUGINS=grafana-loki-datasource
      GF_SECURITY_ADMIN_PASSWORD: admin
      # ... 기타 설정
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
```

**재기동**:

```bash
docker compose down grafana
docker compose up -d grafana
# 검증: docker compose ps → grafana healthy
```

**결과**: Grafana 즉시 healthy 상태로 전환, /api/health 응답 정상

### 근본 해결 원리

- Loki 데이터소스는 **provisioning datasource 파일** (`grafana/provisioning/datasources/loki.yaml`)만으로 등록됨
- GF_INSTALL_PLUGINS는 **외부 커뮤니티 플러그인**(ex. grafana-clock-panel, grafana-worldmap-panel) 설치용
- 빌트인 데이터소스(loki, prometheus, elasticsearch 등)는 플러그인 설치 대상이 **아님** (이미 번들됨)

검증 (Grafana 웹 UI):
- Configuration → Data Sources → Loki 정상 등록
- Loki → 쿼리 → Grafana→Loki 프록시 통신 success
- 대시보드(provisioning/dashboards/loki-dashboard.json) 데이터 적재 확인

### 교훈

**단위테스트로 못 잡는 인프라 버그**
- Docker 빌드 테스트(docker build)는 services 부분을 거치지 않음
- docker-compose 전체 스택 라이브 검증이 필수
- Stage 6에서 "Docker 라이브 검증" 도입으로 발견 가능하게 개선

**재발 방지**
- docker-compose.yml 주석: "빌트인 DS(loki/prometheus) → 플러그인 설치 금지, provisioning만 사용"
- 새 버전 Grafana 업그레이드 시 공식 릴리스노트 확인(빌트인 변경사항)
