# Sentry × Spring Boot 4 — WebClient/RestClient 자동설정 호환 버그

**발견일**: 2026-06-15 (Sprint 12 Stage 7 진행 중, TASK-1205 Tester 단계)
**영향**: 백엔드 Spring 컨텍스트 로딩 실패 → **앱 부팅 불가** (베타 블로커)
**상태**: 해결 (Sentry 8.13.3 → 8.43.2 버전업 + 구 FQCN compat shim 6종)

---

## 증상

`./gradlew test --tests "*BackendApplicationTests*"` 의 `contextLoads()` 가 실패.

```
java.lang.IllegalStateException: Failed to generate bean name for imported class
  'io.sentry.spring.boot.jakarta.SentryAutoConfiguration$HubConfiguration$SentryPerformanceWebClientConfiguration'
Caused by: java.lang.IllegalArgumentException: Could not find class [...WebClientAutoConfiguration]
Caused by: java.lang.ClassNotFoundException:
  org.springframework.boot.autoconfigure.web.reactive.function.client.WebClientAutoConfiguration
```

`@SpringBootTest` 전체 컨텍스트를 로드하는 테스트가 실패하며, 동일 원인으로 실제 애플리케이션도 기동되지 않는다.

## 원인

- **Spring Boot 4.0.5 / Spring Framework 7.0.6** 는 autoconfigure 클래스를 per-feature 모듈로 재구성하고
  패키지를 `org.springframework.boot.autoconfigure.X` → `org.springframework.boot.X.autoconfigure` 로 이동하면서
  구(舊) FQCN을 **제거**했다.
- 그러나 `sentry-spring-boot-starter-jakarta` 는 **최신 8.43.2 까지도** 아래 내부 설정 클래스의
  `@AutoConfigureAfter` / customizer 빈에서 **Boot 3 시절의 구 FQCN을 그대로 참조**한다.
  - `SentryPerformanceWebClientConfiguration` → `...autoconfigure.web.reactive.function.client.WebClientAutoConfiguration`, `...web.reactive.function.client.WebClientCustomizer`
  - `SentryPerformanceRestTemplateConfiguration` → `...autoconfigure.web.client.RestTemplateAutoConfiguration`, `...web.client.RestTemplateCustomizer`
  - `SentrySpanRestClientConfiguration` → `...autoconfigure.web.client.RestClientAutoConfiguration`, `...web.client.RestClientCustomizer`
- 본 프로젝트는 `spring-boot-starter-webflux` 를 사용(MonitoringService / SlackWebhookAdapter 의 WebClient)
  하므로 `@ConditionalOnClass(WebClient)` 가 매칭 → 해당 Sentry 설정이 활성화 → bean name 생성 단계에서
  구 FQCN 로딩 실패 → 컨텍스트 전체 취소.

> 버전업만으로는 해결 불가: 8.21.0+ 가 "Spring Boot 4 지원"을 표방하나 WebClient/RestClient 트레이싱
> 자동설정 경로의 구 FQCN 참조는 8.43.2 에도 남아 있음을 디컴파일(`javap`)로 확인.

## 해결

1. **Sentry 버전업**: `8.13.3` → `8.43.2` (apps/backend/build.gradle.kts). 최신 SDK 채택.
2. **compat shim 6종**: Boot4에서 제거된 구 FQCN을 `apps/backend/src/main/java/org/springframework/...`
   아래에 **빈 클래스(3) + SAM 인터페이스(3)** 로 재현. Boot 4.0.5 jar에 동일 FQCN이 **없음**을 확인하여
   (`unzip -l` grep) 클래스 셰도잉/중복이 아님을 보장.

| FQCN | 종류 | 비고 |
|------|------|------|
| `org.springframework.boot.autoconfigure.web.reactive.function.client.WebClientAutoConfiguration` | 빈 클래스 | ordering 메타데이터 참조만 필요 |
| `org.springframework.boot.autoconfigure.web.client.RestTemplateAutoConfiguration` | 빈 클래스 | 〃 |
| `org.springframework.boot.autoconfigure.web.client.RestClientAutoConfiguration` | 빈 클래스 | 〃 |
| `org.springframework.boot.web.reactive.function.client.WebClientCustomizer` | `@FunctionalInterface` | `void customize(WebClient.Builder)` |
| `org.springframework.boot.web.client.RestTemplateCustomizer` | `@FunctionalInterface` | `void customize(RestTemplate)` |
| `org.springframework.boot.web.client.RestClientCustomizer` | `@FunctionalInterface` | `void customize(RestClient.Builder)` |

시그니처는 Sentry 8.43.2 jar의 `SentrySpan*Customizer` 클래스를 `javap -p` 로 추출한 실제 구현 시그니처와 일치.
Sentry가 생성하는 customizer 빈은 본 프로젝트에서 소비되지 않으므로 **no-op** (Sentry의 WebClient/RestClient
아웃바운드 트레이싱은 동작하지 않으나, 베타 요구사항은 예외 수집 + PII 스크럽이며 이는 정상 동작).

## 제거 조건 (TODO)

Sentry SDK가 Boot4 autoconfigure 패키지(`org.springframework.boot.X.autoconfigure`)를 참조하도록 수정된
버전이 나오면 → 버전업 후 `apps/backend/src/main/java/org/springframework/` shim 디렉토리 **전체 삭제**.
삭제 후 `contextLoads()` 가 통과하는지로 검증.

**Sentry 버전업 시 재확인 절차** (shim 필요 여부 점검):
1. `./gradlew dependencies | grep sentry` 로 해석된 버전 확인.
2. 해당 jar에서 `SentryPerformanceWebClientConfiguration` 등이 여전히 구 FQCN을 참조하는지 확인
   (`javap -v ...$SentryPerformance*.class | grep -oE 'org/springframework/boot/[^ ]*AutoConfiguration'`).
3. 구 FQCN 참조가 사라졌으면 shim 삭제 → `contextLoads()` 통과로 확정. 남아 있으면 shim 유지.

## 교훈

- Stage 6(관측성) 당시 Tester 가 "backend compile OK" 만 확인하고 **전체 컨텍스트 로딩 테스트를 돌리지
  않아** 이 부팅 불가 버그가 main 에 잠복(1d118a7~). 라이브 기동/컨텍스트 로딩 검증의 중요성.
- 이전 세션의 미커밋 `org/` 스텁은 동일 목적의 임시 우회였으나 "Sentry 테스트 잔재"로 오인되어 삭제 대상으로
  기록됨 → 실제로는 부팅에 필요한 load-bearing 코드였음. 정식 문서화+커밋으로 전환.
