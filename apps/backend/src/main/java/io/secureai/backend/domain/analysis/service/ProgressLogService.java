package io.secureai.backend.domain.analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.analysis.dto.ProgressLogResponse;
import io.secureai.backend.domain.analysis.dto.ProgressSummaryResponse;
import io.secureai.backend.domain.analysis.dto.ProgressSummaryResponse.ProgressStepDto;
import io.secureai.backend.domain.analysis.dto.SaveProgressLogRequest;
import io.secureai.backend.domain.analysis.entity.AnalysisProgressLog;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisProgressLogRepository;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProgressLogService {

    private final AnalysisProgressLogRepository progressLogRepository;
    private final AnalysisSessionRepository sessionRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ProgressLogResponse log(SaveProgressLogRequest req) {
        String target = req.target() == null ? "" : req.target();

        if ("started".equals(req.status())) {
            AnalysisProgressLog existing = progressLogRepository
                    .findBySessionIdAndStepNameAndTarget(req.sessionId(), req.stepName(), target)
                    .orElse(null);

            if (existing == null) {
                AnalysisSession session = sessionRepository.findById(req.sessionId())
                        .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_NOT_FOUND));
                existing = AnalysisProgressLog.builder()
                        .session(session)
                        .stepName(req.stepName())
                        .stepOrder(req.stepOrder())
                        .target(target)
                        .status("started")
                        .startedAt(OffsetDateTime.now())
                        .build();
            } else {
                existing.setStatus("started");
                existing.setStartedAt(OffsetDateTime.now());
                existing.setCompletedAt(null);
                existing.setDurationMs(null);
                existing.setDetail(null);
            }

            AnalysisProgressLog saved = progressLogRepository.save(existing);
            log.info("[progress] started session={} step={} target={}", req.sessionId(), req.stepName(), target);
            return ProgressLogResponse.from(saved);
        }

        // completed / failed
        AnalysisProgressLog progressLog = progressLogRepository
                .findBySessionIdAndStepNameAndTarget(req.sessionId(), req.stepName(), target)
                .orElseThrow(() -> new BusinessException(ErrorCode.PROGRESS_LOG_NOT_FOUND));

        OffsetDateTime completedAt = OffsetDateTime.now();
        progressLog.setStatus(req.status());
        progressLog.setCompletedAt(completedAt);
        progressLog.setDurationMs(
                (int) (completedAt.toInstant().toEpochMilli() - progressLog.getStartedAt().toInstant().toEpochMilli())
        );
        if (req.detail() != null) {
            progressLog.setDetail(toJson(req.detail()));
        }

        AnalysisProgressLog saved = progressLogRepository.save(progressLog);
        log.info("[progress] {} session={} step={} target={} duration={}ms",
                req.status(), req.sessionId(), req.stepName(), target, saved.getDurationMs());
        return ProgressLogResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<ProgressLogResponse> getBySessionId(UUID userId, UUID sessionId) {
        AnalysisSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_NOT_FOUND));

        if (!teamMemberRepository.existsByProjectIdAndUserId(session.getProject().getId(), userId)) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }

        return progressLogRepository
                .findBySessionIdOrderByStepOrderAscStartedAtAsc(sessionId)
                .stream()
                .map(ProgressLogResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProgressSummaryResponse getSummary(UUID userId, UUID sessionId) {
        AnalysisSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_NOT_FOUND));

        if (!teamMemberRepository.existsByProjectIdAndUserId(session.getProject().getId(), userId)) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }

        List<AnalysisProgressLog> logs = progressLogRepository
                .findBySessionIdOrderByStepOrderAscStartedAtAsc(sessionId);

        int total = logs.size();
        int completed = (int) logs.stream()
                .filter(l -> "completed".equals(l.getStatus()))
                .count();
        int percentage = total == 0 ? 0 : (completed * 100 / total);

        List<ProgressStepDto> steps = logs.stream()
                .map(l -> new ProgressStepDto(
                        l.getStepName(),
                        l.getStepOrder(),
                        l.getTarget(),
                        l.getStatus(),
                        l.getDurationMs()
                ))
                .toList();

        return new ProgressSummaryResponse(total, completed, percentage, steps);
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }
}
