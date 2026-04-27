package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * AI Agent circuit breaker가 OPEN 상태일 때 실행 중인 세션을 'interrupted'로 자동 전환.
 * 30초 간격으로 실행되며, circuit이 닫혀 있으면 아무 작업도 하지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SessionInterruptionScheduler {

    private final AiAgentClient aiAgentClient;
    private final AnalysisSessionRepository sessionRepository;

    @Scheduled(fixedDelay = 30_000)
    @Transactional
    public void detectInterruptedSessions() {
        if (!aiAgentClient.isCircuitOpen()) return;

        List<AnalysisSession> runningSessions = sessionRepository.findAllRunning();
        if (runningSessions.isEmpty()) return;

        for (AnalysisSession session : runningSessions) {
            session.markInterrupted();
            sessionRepository.save(session);
        }
        log.warn("[scheduler] AI Agent circuit OPEN — marked {} sessions as interrupted",
                runningSessions.size());
    }
}
