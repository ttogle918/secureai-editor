package io.secureai.backend.domain.analysis.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.analysis.entity.PrReviewHistory;
import io.secureai.backend.domain.analysis.event.SessionCompletedEvent;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.analysis.repository.PrReviewHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Redis Pub/Sub 수신기 — ai_engine이 발행하는 진행 이벤트를 SSE로 릴레이한다.
 *
 * 설계 원칙:
 * - DTO 라운드트립을 제거하고 원본 JSON body를 Map으로 변환해 SSE로 패스스루한다.
 *   이렇게 하면 snake_case 키(phase, stage_no, stages 등)가 camelCase 재직렬화 없이
 *   프론트엔드까지 그대로 전달된다.
 * - sessionId는 채널명(secureai:progress:{uuid})에서 추출 — body 파싱 의존 없음.
 * - type 필드만 JsonNode.path("type")으로 가볍게 추출하여 completed/error 분기에 사용.
 * - PR 웹훅 트리거 세션: findBySessionId로 PrReviewHistory 역조회 후 Check Run 완료 처리.
 *   일반 분석 세션이면 findBySessionId empty → 기존 동작 그대로 유지.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RedisSubscriber implements MessageListener {

    private static final String TYPE_COMPLETED              = "completed";
    private static final String TYPE_ERROR                  = "error";
    /** STAGE-2: planning_node interrupt 후 사용자 컨펌 대기 이벤트. */
    private static final String TYPE_AWAITING_CONFIRMATION  = "awaiting_confirmation";

    private final SseEmitterService sseEmitterService;
    private final AnalysisSessionRepository sessionRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;
    private final PrReviewHistoryRepository prReviewHistoryRepository;
    private final GitHubWebhookService gitHubWebhookService;
    private final GitHubAppAuthService gitHubAppAuthService;

    @Override
    @Transactional
    public void onMessage(Message message, byte[] pattern) {
        try {
            String channel = new String(message.getChannel());
            String body    = new String(message.getBody());

            // 채널에서 sessionId 추출: secureai:progress:{uuid}
            String sessionIdStr = channel.substring(channel.lastIndexOf(':') + 1);
            UUID sessionId = UUID.fromString(sessionIdStr);

            // type과 vuln_count만 가볍게 파싱 — 전체 DTO 역직렬화 대신 JsonNode.path 사용
            JsonNode tree = objectMapper.readTree(body);
            String type = tree.path("type").asText("");

            // 원본 JSON을 Map으로 변환 → snake_case 키가 그대로 SSE payload에 포함됨
            Map<String, Object> payload = objectMapper.readValue(body, new TypeReference<Map<String, Object>>() {});
            sseEmitterService.send(sessionId, payload);

            if (TYPE_COMPLETED.equals(type)) {
                int vulnCount = tree.path("vuln_count").asInt(0);
                handleCompleted(sessionId, vulnCount);
                sseEmitterService.complete(sessionId);
            } else if (TYPE_ERROR.equals(type)) {
                handleError(sessionId);
                sseEmitterService.complete(sessionId);
            } else if (TYPE_AWAITING_CONFIRMATION.equals(type)) {
                // STAGE-2: planning_node interrupt → 세션 status AWAITING_CONFIRMATION 전환
                handleAwaitingConfirmation(sessionId);
            }
        } catch (Exception e) {
            log.warn("[redis-sub] failed to process message", e);
        }
    }

    // ─── Private Handlers ─────────────────────────────────────────────────────

    private void handleCompleted(UUID sessionId, int vulnCount) {
        // 일반 분석 세션 처리
        sessionRepository.findById(sessionId).ifPresent(session -> {
            session.markCompleted();
            sessionRepository.save(session);
            eventPublisher.publishEvent(new SessionCompletedEvent(
                    this, sessionId, session.getProject().getId(), session.getUser().getId()));
            log.info("[redis-sub] session completed sessionId={}", sessionId);
        });

        // PR 웹훅 트리거 세션이면 Check Run 완료 + PR 코멘트 처리
        Optional<PrReviewHistory> prHistory = prReviewHistoryRepository.findBySessionId(sessionId);
        prHistory.ifPresent(history -> finalizePrCompleted(history, vulnCount));
    }

    /**
     * STAGE-2: planning_node interrupt 후 사용자 컨펌 대기 상태로 전환한다.
     * SSE 연결은 유지(complete 호출 없음) — 프론트엔드가 컨펌 후 이벤트를 계속 수신해야 함.
     */
    private void handleAwaitingConfirmation(UUID sessionId) {
        sessionRepository.findById(sessionId).ifPresent(session -> {
            session.markAwaitingConfirmation();
            sessionRepository.save(session);
            log.info("[redis-sub] session awaiting confirmation sessionId={}", sessionId);
        });
    }

    private void handleError(UUID sessionId) {
        // 일반 분석 세션 처리
        sessionRepository.findById(sessionId).ifPresent(session -> {
            session.markError();
            sessionRepository.save(session);
            log.warn("[redis-sub] session error sessionId={}", sessionId);
        });

        // PR 웹훅 트리거 세션이면 Check Run failure 처리
        Optional<PrReviewHistory> prHistory = prReviewHistoryRepository.findBySessionId(sessionId);
        prHistory.ifPresent(this::finalizePrError);
    }

    /**
     * PR 분석 완료 처리.
     * 설치 토큰을 재발급(원 토큰 만료 대비)하여 Check Run 완료 + PR 코멘트를 등록한다.
     * 실패 시 skip & log — PR 이력 자체는 항상 업데이트한다.
     */
    private void finalizePrCompleted(PrReviewHistory history, int vulnCount) {
        try {
            String freshToken = refreshInstallationToken(history);
            gitHubWebhookService.completeCheckRunAfterAnalysis(
                    history.getRepoOwner(), history.getRepoName(),
                    history.getCheckRunId(), vulnCount, history.getPrNumber(), freshToken);
            history.markCompleted(vulnCount, history.getCheckRunId());
            prReviewHistoryRepository.save(history);
            log.info("[redis-sub] PR 분석 완료 처리 sessionId={} vulnCount={}", history.getSessionId(), vulnCount);
        } catch (Exception e) {
            log.warn("[redis-sub] PR 완료 처리 실패 — history는 markError sessionId={} err={}",
                    history.getSessionId(), e.getMessage());
            history.markError();
            prReviewHistoryRepository.save(history);
        }
    }

    /**
     * PR 분석 오류 처리.
     * Check Run을 failure로 완료하고 history를 error 상태로 전이한다.
     */
    private void finalizePrError(PrReviewHistory history) {
        try {
            String freshToken = refreshInstallationToken(history);
            if (freshToken != null && !freshToken.isBlank() && history.getCheckRunId() != null) {
                gitHubWebhookService.finalizeCheckRunOnError(
                        history.getRepoOwner(), history.getRepoName(),
                        history.getCheckRunId(), freshToken);
            }
        } catch (Exception e) {
            log.warn("[redis-sub] PR 오류 Check Run 완료 실패 sessionId={} err={}",
                    history.getSessionId(), e.getMessage());
        }
        history.markError();
        prReviewHistoryRepository.save(history);
        log.warn("[redis-sub] PR 분석 오류 처리 sessionId={}", history.getSessionId());
    }

    /**
     * PrReviewHistory에 저장된 installationId로 설치 토큰을 재발급한다.
     * installationId가 null이거나 재발급 실패 시 빈 문자열 반환 (skip & log).
     * 토큰은 반환값으로만 전달 — 로그 출력 금지.
     */
    private String refreshInstallationToken(PrReviewHistory history) {
        Long installationId = history.getInstallationId();
        if (installationId == null) {
            log.warn("[redis-sub] installationId 없음 — token 재발급 생략 sessionId={}", history.getSessionId());
            return "";
        }
        try {
            return gitHubAppAuthService.exchangeInstallationToken(installationId);
        } catch (Exception e) {
            log.warn("[redis-sub] 설치 토큰 재발급 실패 installationId={} err={}", installationId, e.getMessage());
            return "";
        }
    }
}
