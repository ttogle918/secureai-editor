package io.secureai.backend.infrastructure.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

/**
 * 지속 모니터링 Job 커스텀 Prometheus 메트릭.
 *
 * <p>SRP: 메트릭 집계 책임만 담당한다.
 * DIP: MeterRegistry 인터페이스에 의존하므로 Prometheus/Atlas 구현체 교체 시 변경 불필요.
 */
@Component
public class MonitoringMetrics {

    private final Counter monitoringJobRunsTotal;

    public MonitoringMetrics(MeterRegistry registry) {
        this.monitoringJobRunsTotal = Counter.builder("secureai_monitoring_job_runs_total")
                .description("Total monitoring job runs")
                .register(registry);
    }

    public void increment() {
        monitoringJobRunsTotal.increment();
    }
}
