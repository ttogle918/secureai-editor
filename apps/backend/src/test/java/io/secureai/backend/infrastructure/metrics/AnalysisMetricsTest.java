package io.secureai.backend.infrastructure.metrics;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class AnalysisMetricsTest {

    private SimpleMeterRegistry registry;
    private AnalysisMetrics metrics;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        metrics = new AnalysisMetrics(registry);
    }

    @Test
    @DisplayName("incrementSessions() 호출 후 secureai_analysis_sessions_total counter가 1.0이다")
    void incrementSessions_incrementsSessionsCounter() {
        // when
        metrics.incrementSessions();

        // then
        double count = registry.find("secureai_analysis_sessions_total").counter().count();
        assertThat(count).isEqualTo(1.0);
    }

    @Test
    @DisplayName("incrementErrors() 호출 후 secureai_analysis_errors_total counter가 1.0이다")
    void incrementErrors_incrementsErrorsCounter() {
        // when
        metrics.incrementErrors();

        // then
        double count = registry.find("secureai_analysis_errors_total").counter().count();
        assertThat(count).isEqualTo(1.0);
    }

    @Test
    @DisplayName("addTokens(100.0) 호출 후 secureai_ai_tokens_total counter가 100.0이다")
    void addTokens_incrementsTokensCounterByGivenAmount() {
        // when
        metrics.addTokens(100.0);

        // then
        double count = registry.find("secureai_ai_tokens_total").counter().count();
        assertThat(count).isEqualTo(100.0);
    }
}
