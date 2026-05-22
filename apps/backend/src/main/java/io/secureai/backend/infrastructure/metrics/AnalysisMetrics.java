package io.secureai.backend.infrastructure.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

/**
 * 분석 파이프라인 커스텀 Prometheus 메트릭.
 *
 * <p>SRP: 메트릭 집계 책임만 담당한다. 도메인 서비스가 이 클래스를 주입받아
 * 이벤트 발생 시 카운터를 증감시킨다.
 *
 * <p>DIP: MeterRegistry 인터페이스에 의존하므로 구현체(Prometheus/Atlas 등)를
 * 교체해도 이 클래스는 변경하지 않는다.
 */
@Component
public class AnalysisMetrics {

    private final Counter analysisSessionsTotal;
    private final Counter analysisErrorsTotal;
    private final Counter dastSuccessTotal;
    private final Counter aiTokensTotal;

    public AnalysisMetrics(MeterRegistry registry) {
        this.analysisSessionsTotal = Counter.builder("secureai_analysis_sessions_total")
                .description("Total analysis sessions started")
                .register(registry);
        this.analysisErrorsTotal = Counter.builder("secureai_analysis_errors_total")
                .description("Total analysis sessions failed")
                .register(registry);
        this.dastSuccessTotal = Counter.builder("secureai_dast_success_total")
                .description("DAST exploits that succeeded")
                .register(registry);
        this.aiTokensTotal = Counter.builder("secureai_ai_tokens_total")
                .description("Total AI tokens consumed")
                .register(registry);
    }

    public void incrementSessions() {
        analysisSessionsTotal.increment();
    }

    public void incrementErrors() {
        analysisErrorsTotal.increment();
    }

    public void incrementDastSuccess() {
        dastSuccessTotal.increment();
    }

    public void addTokens(double count) {
        aiTokensTotal.increment(count);
    }
}
